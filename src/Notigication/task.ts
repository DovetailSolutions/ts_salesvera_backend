import { Server } from "socket.io";
import { Task, User, Device } from "../config/dbConnection";
import { sendPushNotification } from "../config/Notification";

const ADMIN_MANAGER = ["admin", "super_admin", "manager"];

// ─── Push notification to a user's registered devices ────────────────────────
const pushToUser = async (
  userId: number,
  title: string,
  body: string,
  data: Record<string, string> = {}
) => {
  try {
    const devices = await Device.findAll({ where: { userId, isActive: true } });
    const tokens = devices.map((d: any) => d.deviceToken).filter(Boolean);
    if (tokens.length > 0) {
      await sendPushNotification({ token: tokens, title, body, data });
    }
  } catch (err) {
    console.error("task push error:", err);
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
      if (!ADMIN_MANAGER.includes(role)) {
        return socket.emit("taskError", { message: "Forbidden" });
      }

      const { title, description, priority, dueDate, assignedTo, tags } = data;

      if (!title || !assignedTo) {
        return socket.emit("taskError", { message: "title and assignedTo are required" });
      }

      try {
        const assignee = await (User as any).findByPk(assignedTo, {
          attributes: ["id", "role", "status"],
        });

        if (!assignee || assignee.status !== "active") {
          return socket.emit("taskError", { message: "Assigned user not found or inactive" });
        }

        const assigneeRole: string = assignee.role;

        if (role === "manager" && assigneeRole !== "sale_person") {
          return socket.emit("taskError", { message: "Managers can only assign tasks to sale persons" });
        }
        if (
          (role === "admin" || role === "super_admin") &&
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

        await pushToUser(Number(assignedTo), "New Task Assigned", `You have a new task: ${title}`, {
          taskId: String(task.id),
          type: "task_assigned",
        });
      } catch (err) {
        console.error("createTask socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });

    // ── GET ALL TASKS ────────────────────────────────────────────────────────
    // client emits: getAllTasks  { status?, priority?, assignedTo?, page?, limit?, tags? }
    socket.on("getAllTasks", async (data = {}) => {
      const { status, priority, assignedTo, page = 1, limit: limitQ = 20, tags } = data;
      const pageNum  = Math.max(1, Number(page));
      const limitNum = Math.min(50, Number(limitQ));
      const offset   = (pageNum - 1) * limitNum;

      try {
        const where: any = { companyId: Number(companyId) };

        if (role === "manager")     where.assignedBy = uid;
        if (role === "sale_person") where.assignedTo = uid;

        if (status)   where.status   = status;
        if (priority) where.priority = priority;
        if (tags)     where.tags     = tags;
        if (assignedTo && role !== "sale_person") where.assignedTo = Number(assignedTo);

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
      try {
        const where: any = { id, companyId: Number(companyId) };
        if (role === "manager")     where.assignedBy = uid;
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
      const { id, title, description, status, priority, dueDate, assignedTo } = data;

      try {
        const where: any = { id, companyId: Number(companyId) };
        if (role === "manager")     where.assignedBy = uid;
        if (role === "sale_person") where.assignedTo = uid;

        const task = await Task.findOne({ where });
        if (!task) return socket.emit("taskError", { message: "Task not found" });

        const prevAssignee = task.assignedTo;

        if (role === "sale_person") {
          if (status !== undefined) task.status = status;
        } else {
          if (assignedTo !== undefined) {
            const assignee = await (User as any).findByPk(assignedTo, {
              attributes: ["id", "role", "status"],
            });
            if (!assignee || assignee.status !== "active") {
              return socket.emit("taskError", { message: "Assigned user not found or inactive" });
            }
            const assigneeRole: string = assignee.role;
            if (role === "manager" && assigneeRole !== "sale_person") {
              return socket.emit("taskError", { message: "Managers can only assign tasks to sale persons" });
            }
            if (
              (role === "admin" || role === "super_admin") &&
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

        await task.save();
        const payload = task.toJSON();

        broadcast("taskUpdated", payload, task.assignedTo ? Number(task.assignedTo) : undefined);

        // Also notify previous assignee if task was reassigned
        if (
          assignedTo !== undefined &&
          prevAssignee &&
          Number(prevAssignee) !== Number(assignedTo)
        ) {
          io.to(`task:user:${prevAssignee}`).emit("taskUpdated", payload);

          await pushToUser(Number(assignedTo), "Task Reassigned", `Task updated: ${task.title}`, {
            taskId: String(task.id),
            type: "task_updated",
          });
        }
      } catch (err) {
        console.error("updateTask socket error:", err);
        socket.emit("taskError", { message: "Internal server error" });
      }
    });

    // ── DELETE TASK ──────────────────────────────────────────────────────────
    // client emits: deleteTask  { id }
    socket.on("deleteTask", async ({ id }) => {
      if (!ADMIN_MANAGER.includes(role)) {
        return socket.emit("taskError", { message: "Forbidden" });
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
