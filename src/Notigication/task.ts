import { Server } from "socket.io";
import { Op } from "sequelize";
import { Task, TaskHistory, User, Permission, UserPermission } from "../config/dbConnection";
import { getUserPermissionsFromCache } from "../config/permissionCache";
import { sendNotification } from "../config/notificationService";
import { NotificationType } from "../app/model/Notification";
import { getDirectCreator } from "../modules/shared/userHierarchy";

const ADMIN_MANAGER = ["admin", "super_admin", "manager"];

const loadUserPermissionsFromDB = async (userId: number): Promise<string[]> => {
  const userPerms = await UserPermission.findAll({
    where: { userId },
    include: [{ model: Permission, as: "permission", attributes: ["module", "action"] }],
    attributes: [],
  });
  return userPerms.map((up: any) => `${up.permission.module}:${up.permission.action}`);
};

const hasPermission = async (userId: number, companyId: number, role: string, action: string): Promise<boolean> => {
  if (role === "super_admin") return true;
  const perms = await getUserPermissionsFromCache(userId, () => loadUserPermissionsFromDB(userId));
  console.log(">>>>>>>>>>>>>>>>>>>>>hasPermission",hasPermission)
  return perms.has(`task:${action}`);
};

// ─── Record a single field change in task_history ────────────────────────────
const logHistory = async (
  taskId: number,
  changedBy: number,
  field: string,
  oldValue: any,
  newValue: any
) => {
  try {
    await TaskHistory.create({
      taskId,
      changedBy,
      field,
      oldValue: oldValue != null ? String(oldValue) : undefined,
      newValue: newValue != null ? String(newValue) : undefined,
    });
  } catch (err) {
    console.error("logHistory error:", err);
  }
};

// ─── Registers all task socket events on the SAME main io namespace ──────────
// chat.ts already sets socket.data.user via io.use() middleware, so auth is shared.
export const initTaskSocket = (io: Server): void => {
  io.on("connection", (socket) => {
    const user = socket.data?.user;
    if (!user) return; // unauthenticated — chat middleware already rejected it

    const { userId, role, companyId } = user;
    const uid = Number(userId);

    // Join task rooms — prefixed so they never clash with chat room IDs
    socket.join(`task:user:${uid}`);
    if (ADMIN_MANAGER.includes(role)) {
      socket.join(`task:company:${companyId}`);
    }

    // Emit a task event to the company room AND to the assignee's personal room
    const broadcast = (
      event: "taskCreated" | "taskUpdated" | "taskDeleted",
      payload: Record<string, any>,
      assignedToId?: number
    ) => {
      io.to(`task:company:${companyId}`).emit(event, payload);
      if (assignedToId) {
        io.to(`task:user:${assignedToId}`).emit(event, payload);
      }
    };

    // ── CREATE TASK ──────────────────────────────────────────────────────────
    // client emits: createTask  { title, assignedTo, description?, priority?, dueDate?, tags? }
    socket.on("createTask", async (data) => {

      console.log(">>>>>>>>>>>>>>>>>>>>>>>createTask",uid, companyId, role, "create")
      if (!await hasPermission(uid, companyId, role, "create")) {
        return socket.emit("taskError", { message: "Forbidden — you do not have task:create permission" });
      }

      const { title, description, priority, dueDate, assignedTo, tags } = data;

      if (!title || !assignedTo) {
        return socket.emit("taskError", { message: "title and assignedTo are required" });
      }

      try {
        const assignee = await (User as any).findByPk(assignedTo, {
          attributes: ["id", "role", "status", "tenantId"],
        });

        if (!assignee || assignee.status !== "active") {
          return socket.emit("taskError", { message: "Assigned user not found or inactive" });
        }

        // Tenant isolation: cannot assign tasks across tenant boundaries
        if (role !== "super_admin") {
          const caller = await (User as any).findByPk(uid, { attributes: ["tenantId"] });
          if (caller?.tenantId && caller.tenantId !== assignee.tenantId) {
            return socket.emit("taskError", { message: "Cannot assign tasks to users outside your tenant" });
          }
        }

        const assigneeRole: string = assignee.role;

        if (
          (role === "admin" || role === "super_admin" || role === "manager") &&
          !["manager", "sale_person"].includes(assigneeRole)
        ) {
          return socket.emit("taskError", { message: "Tasks can only be assigned to managers or sale persons" });
        }

        const task = await Task.create({
          title,
          description,
          priority: priority ?? "medium",
          dueDate: dueDate ?? undefined,
          assignedTo: Number(assignedTo),
          assignedBy: uid,
          companyId: Number(companyId),
          tags: tags ?? null,
        });

        const payload = task.toJSON();

        broadcast("taskCreated", payload, Number(assignedTo));

        await logHistory(task.id, uid, "assignedTo", null, assignedTo);

        // FIX: previously used pushToUser (raw FCM push only) — no DB
        // Notification row, no bell entry, no real-time "notification"
        // socket event. sendNotification does all three plus the push.
        await sendNotification({
          receiverId: Number(assignedTo),
          senderId: uid,
          type: NotificationType.TASK,
          title: "New Task Assigned",
          body: `You have a new task: ${title}`,
          data: { taskId: String(task.id), event: "task_assigned" },
        });
      } catch (err) {
        console.error("createTask socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });

    // ── GET ALL TASKS ────────────────────────────────────────────────────────
    // client emits: getAllTasks  { status?, priority?, assignedTo?, assignedBy?, page?, limit?, tags?, dateScope? }
    // dateScope ("today" | "history") only applies when status is exactly
    // "completed" — lets the board show "done today" vs a separate task
    // history view without changing default (undated) behavior for every
    // other query (the main kanban board still fetches all statuses at once).
    socket.on("getAllTasks", async (data = {}) => {
      if (!await hasPermission(uid, companyId, role, "view")) {
        return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
      }
      const { status, priority, assignedTo, assignedBy, page = 1, limit: limitQ = 20, tags, dateScope } = data;
      const pageNum  = Math.max(1, Number(page));
      const limitNum = Math.min(50, Number(limitQ));
      const offset   = (pageNum - 1) * limitNum;

      try {
        const where: any = { companyId: Number(companyId) };

        if (role === "manager")     where[Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];
        if (role === "sale_person") where.assignedTo = uid;

        if (status)   where.status   = status;
        if (priority) where.priority = priority;
        if (tags)     where.tags     = tags;
        if (assignedTo && role !== "sale_person") where.assignedTo = Number(assignedTo);
        // admin/super_admin can filter by who created/assigned the task
        if (assignedBy && (role === "admin" || role === "super_admin")) where.assignedBy = Number(assignedBy);

        if (status === "completed" && (dateScope === "today" || dateScope === "history")) {
          const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
          where.completedAt = dateScope === "today"
            ? { [Op.between]: [startOfToday, endOfToday] }
            : { [Op.lt]: startOfToday };
        }

        const { count, rows } = await Task.findAndCountAll({
          where,
          include: [
            { model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "email", "role"] },
            { model: User, as: "creator",  attributes: ["id", "firstName", "lastName", "email", "role"] },
          ],
          order: [["createdAt", "DESC"]],
          limit: limitNum,
          offset,
        });

        socket.emit("taskList", {
          success: true,
          total: count,
          totalPages: Math.ceil(count / limitNum),
          currentPage: pageNum,
          data: rows,
        });
      } catch (err) {
        console.error("getAllTasks socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });

    // ── GET TASK BY ID ───────────────────────────────────────────────────────
    // client emits: getTaskById  { id }
    socket.on("getTaskById", async ({ id }) => {
      if (!await hasPermission(uid, companyId, role, "view")) {
        return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
      }
      try {
        // FIX: previously admin/super_admin had no companyId filter at all
        // here (only manager/sale_person were scoped) — any admin could
        // fetch a task belonging to another company by ID.
        const where: any = { id };
        if (role !== "super_admin") where.companyId = Number(companyId);
        if (role === "manager")     where[Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];
        if (role === "sale_person") where.assignedTo = uid;

        const task = await Task.findOne({
          where,
          include: [
            { model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "email", "role"] },
            { model: User, as: "creator",  attributes: ["id", "firstName", "lastName", "email", "role"] },
          ],
        });

        if (!task) return socket.emit("taskError", { message: "Task not found" });

        socket.emit("taskDetail", { success: true, data: task });
      } catch (err) {
        console.error("getTaskById socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });

    // ── UPDATE TASK ──────────────────────────────────────────────────────────
    // client emits: updateTask  { id, title?, description?, status?, priority?, dueDate?, assignedTo? }
    // sale_person can only update status of tasks assigned to them
    socket.on("updateTask", async (data) => {
      if (!await hasPermission(uid, companyId, role, "update")) {
        return socket.emit("taskError", { message: "Forbidden — you do not have task:update permission" });
      }
      const { id, title, description, status, priority, dueDate, assignedTo } = data;

      try {
        // FIX: previously admin/super_admin had no companyId filter here
        // either — any admin could update a task belonging to another
        // company by ID.
        const where: any = { id };
        if (role !== "super_admin") where.companyId = Number(companyId);
        if (role === "manager")     where[Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];
        if (role === "sale_person") where[Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];

        const task = await Task.findOne({ where });
        if (!task) return socket.emit("taskError", { message: "Task not found" });

        const prevAssignee   = task.assignedTo;
        const prevStatus     = task.status;
        const prevPriority   = task.priority;
        const prevTitle      = task.title;
        const prevDesc       = task.description;
        const prevDueDate    = task.dueDate;

        if (role === "sale_person") {
          if (status !== undefined) task.status = status;
        } else {
          if (assignedTo !== undefined) {
            const assignee = await (User as any).findByPk(assignedTo, {
              attributes: ["id", "role", "status", "tenantId"],
            });
            if (!assignee || assignee.status !== "active") {
              return socket.emit("taskError", { message: "Assigned user not found or inactive" });
            }
            // Tenant isolation on reassignment
            if (role !== "super_admin") {
              const caller = await (User as any).findByPk(uid, { attributes: ["tenantId"] });
              if (caller?.tenantId && caller.tenantId !== assignee.tenantId) {
                return socket.emit("taskError", { message: "Cannot assign tasks to users outside your tenant" });
              }
            }
            const assigneeRole: string = assignee.role;
            if (
              (role === "admin" || role === "super_admin" || role === "manager") &&
              !["manager", "sale_person"].includes(assigneeRole)
            ) {
              return socket.emit("taskError", { message: "Tasks can only be assigned to managers or sale persons" });
            }
            task.assignedTo = Number(assignedTo);
          }

          if (title !== undefined)       task.title       = title;
          if (description !== undefined) task.description = description;
          if (status !== undefined)      task.status      = status;
          if (priority !== undefined)    task.priority    = priority;
          if (dueDate !== undefined)     task.dueDate     = dueDate;
        }

        // Track when a task actually became "completed" — distinguishes
        // "done today" from older completed tasks (task history), which
        // previously had no way to be told apart at all.
        if (status !== undefined && status !== prevStatus) {
          if (status === "completed") task.completedAt = new Date();
          else if (prevStatus === "completed") task.completedAt = null;
        }

        await task.save();

        // Log each changed field
        const historyLogs: Promise<void>[] = [];
        if (assignedTo !== undefined && Number(prevAssignee) !== Number(assignedTo))
          historyLogs.push(logHistory(task.id, uid, "assignedTo", prevAssignee, assignedTo));
        if (status !== undefined && prevStatus !== status)
          historyLogs.push(logHistory(task.id, uid, "status", prevStatus, status));
        if (priority !== undefined && prevPriority !== priority)
          historyLogs.push(logHistory(task.id, uid, "priority", prevPriority, priority));
        if (title !== undefined && prevTitle !== title)
          historyLogs.push(logHistory(task.id, uid, "title", prevTitle, title));
        if (description !== undefined && prevDesc !== description)
          historyLogs.push(logHistory(task.id, uid, "description", prevDesc, description));
        if (dueDate !== undefined && String(prevDueDate) !== String(dueDate))
          historyLogs.push(logHistory(task.id, uid, "dueDate", prevDueDate, dueDate));
        await Promise.all(historyLogs);

        const payload = task.toJSON();

        broadcast("taskUpdated", payload, task.assignedTo ? Number(task.assignedTo) : undefined);

        // Also notify previous assignee if task was reassigned
        if (
          assignedTo !== undefined &&
          prevAssignee &&
          Number(prevAssignee) !== Number(assignedTo)
        ) {
          io.to(`task:user:${prevAssignee}`).emit("taskUpdated", payload);

          await sendNotification({
            receiverId: Number(assignedTo),
            senderId: uid,
            type: NotificationType.TASK,
            title: "Task Reassigned",
            body: `Task updated: ${task.title}`,
            data: { taskId: String(task.id), event: "task_updated" },
          });
        }

        // Task completed → escalate up the chain: notify whoever assigned
        // it (if not the completer) and the completer's own direct
        // manager/admin (sale_person → their manager; manager → their
        // admin), deduped so the same person never gets notified twice.
        // Previously no completion notification existed at all.
        if (status !== undefined && status === "completed" && prevStatus !== "completed") {
          const recipients = new Set<number>();
          if (task.assignedBy && Number(task.assignedBy) !== uid) recipients.add(Number(task.assignedBy));

          const directCreator = await getDirectCreator(uid);
          if (directCreator && directCreator.id !== uid) recipients.add(directCreator.id);

          await Promise.all(
            Array.from(recipients).map((receiverId) =>
              sendNotification({
                receiverId,
                senderId: uid,
                type: NotificationType.TASK,
                title: "Task Completed",
                body: `"${task.title}" was marked completed.`,
                data: { taskId: String(task.id), event: "task_completed" },
              })
            )
          );
        }
      } catch (err) {
        console.error("updateTask socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });

    // ── GET TASK HISTORY ─────────────────────────────────────────────────────
    // client emits: getTaskHistory  { id }
    // Returns the full audit trail for a task (Jira-like activity log)
    socket.on("getTaskHistory", async ({ id }) => {
      if (!await hasPermission(uid, companyId, role, "view")) {
        return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
      }
      try {
        const where: any = { id, companyId: Number(companyId) };
        if (role === "manager")     where.assignedBy = uid;
        if (role === "sale_person") where.assignedTo = uid;

        const task = await Task.findOne({ where, attributes: ["id"] });
        if (!task) return socket.emit("taskError", { message: "Task not found" });

        const history = await TaskHistory.findAll({
          where: { taskId: Number(id) },
          include: [
            {
              model: User,
              as: "changedByUser",
              attributes: ["id", "firstName", "lastName", "email", "role"],
            },
          ],
          order: [["createdAt", "ASC"]],
        });

        socket.emit("taskHistory", { success: true, taskId: Number(id), data: history });
      } catch (err) {
        console.error("getTaskHistory socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });

    // ── DELETE TASK ──────────────────────────────────────────────────────────
    // client emits: deleteTask  { id }
    socket.on("deleteTask", async ({ id }) => {
      if (!await hasPermission(uid, companyId, role, "delete")) {
        return socket.emit("taskError", { message: "Forbidden — you do not have task:delete permission" });
      }

      try {
        const where: any = { id, companyId: Number(companyId) };
        if (role === "manager") where.assignedBy = uid;

        const task = await Task.findOne({ where });
        if (!task) return socket.emit("taskError", { message: "Task not found" });

        const assignedToId = task.assignedTo;
        await task.destroy();

        broadcast("taskDeleted", { id: Number(id) }, assignedToId ? Number(assignedToId) : undefined);
      } catch (err) {
        console.error("deleteTask socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });
  });
};

  



