"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTaskSocket = void 0;
const sequelize_1 = require("sequelize");
const dbConnection_1 = require("../config/dbConnection");
const permissionCache_1 = require("../config/permissionCache");
const notificationService_1 = require("../config/notificationService");
const Notification_1 = require("../app/model/Notification");
const userHierarchy_1 = require("../modules/shared/userHierarchy");
const ADMIN_MANAGER = ["admin", "super_admin", "manager"];
const loadUserPermissionsFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userPerms = yield dbConnection_1.UserPermission.findAll({
        where: { userId },
        include: [{ model: dbConnection_1.Permission, as: "permission", attributes: ["module", "action"] }],
        attributes: [],
    });
    return userPerms.map((up) => `${up.permission.module}:${up.permission.action}`);
});
const hasPermission = (userId, companyId, role, action) => __awaiter(void 0, void 0, void 0, function* () {
    if (role === "super_admin")
        return true;
    const perms = yield (0, permissionCache_1.getUserPermissionsFromCache)(userId, () => loadUserPermissionsFromDB(userId));
    return perms.has(`task:${action}`);
});
// ─── Shared "which tasks can this caller see" where-clause ───────────────────
// admin/super_admin/manager/user all see the whole company; sale_person only
// ever sees tasks assigned to them. Centralized so the visibility rule is
// defined once instead of drifting across getTaskById/updateTask/comments/
// history like it previously did (manager used to be wrongly restricted to
// only their own created/assigned tasks here).
const buildTaskVisibilityWhere = (companyId, role, uid, taskId) => {
    const where = {};
    if (taskId !== undefined)
        where.id = taskId;
    if (role !== "super_admin")
        where.companyId = Number(companyId);
    if (role === "sale_person")
        where.assignedTo = uid;
    return where;
};
// ─── Record a single field change in task_history ────────────────────────────
const logHistory = (taskId, changedBy, field, oldValue, newValue) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield dbConnection_1.TaskHistory.create({
            taskId,
            changedBy,
            field,
            oldValue: oldValue != null ? String(oldValue) : undefined,
            newValue: newValue != null ? String(newValue) : undefined,
        });
    }
    catch (err) {
        console.error("logHistory error:", err);
    }
});
// ─── Registers all task socket events on the SAME main io namespace ──────────
// chat.ts already sets socket.data.user via io.use() middleware, so auth is shared.
const initTaskSocket = (io) => {
    io.on("connection", (socket) => {
        var _a;
        const user = (_a = socket.data) === null || _a === void 0 ? void 0 : _a.user;
        if (!user)
            return; // unauthenticated — chat middleware already rejected it
        const { userId, role, companyId } = user;
        const uid = Number(userId);
        // Join task rooms — prefixed so they never clash with chat room IDs
        socket.join(`task:user:${uid}`);
        if (ADMIN_MANAGER.includes(role)) {
            socket.join(`task:company:${companyId}`);
        }
        // Emit a task event to the company room AND to the assignee's personal room
        const broadcast = (event, payload, assignedToId) => {
            io.to(`task:company:${companyId}`).emit(event, payload);
            if (assignedToId) {
                io.to(`task:user:${assignedToId}`).emit(event, payload);
            }
        };
        // ── CREATE TASK ──────────────────────────────────────────────────────────
        // client emits: createTask  { title, assignedTo, description?, priority?, dueDate?, tags? }
        socket.on("createTask", (data) => __awaiter(void 0, void 0, void 0, function* () {
            if (!(yield hasPermission(uid, companyId, role, "create"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:create permission" });
            }
            const { title, description, priority, dueDate, assignedTo, tags } = data;
            if (!title || !assignedTo) {
                return socket.emit("taskError", { message: "title and assignedTo are required" });
            }
            try {
                const assignee = yield dbConnection_1.User.findByPk(assignedTo, {
                    attributes: ["id", "role", "status", "tenantId"],
                });
                if (!assignee || assignee.status !== "active") {
                    return socket.emit("taskError", { message: "Assigned user not found or inactive" });
                }
                // Tenant isolation: cannot assign tasks across tenant boundaries
                if (role !== "super_admin") {
                    const caller = yield dbConnection_1.User.findByPk(uid, { attributes: ["tenantId"] });
                    if ((caller === null || caller === void 0 ? void 0 : caller.tenantId) && caller.tenantId !== assignee.tenantId) {
                        return socket.emit("taskError", { message: "Cannot assign tasks to users outside your tenant" });
                    }
                }
                const assigneeRole = assignee.role;
                if ((role === "admin" || role === "super_admin" || role === "manager") &&
                    !["manager", "sale_person"].includes(assigneeRole)) {
                    return socket.emit("taskError", { message: "Tasks can only be assigned to managers or sale persons" });
                }
                const task = yield dbConnection_1.Task.create({
                    title,
                    description,
                    priority: priority !== null && priority !== void 0 ? priority : "medium",
                    dueDate: dueDate !== null && dueDate !== void 0 ? dueDate : undefined,
                    assignedTo: Number(assignedTo),
                    assignedBy: uid,
                    companyId: Number(companyId),
                    tags: tags !== null && tags !== void 0 ? tags : null,
                });
                const payload = task.toJSON();
                broadcast("taskCreated", payload, Number(assignedTo));
                yield logHistory(task.id, uid, "assignedTo", null, assignedTo);
                // FIX: previously used pushToUser (raw FCM push only) — no DB
                // Notification row, no bell entry, no real-time "notification"
                // socket event. sendNotification does all three plus the push.
                yield (0, notificationService_1.sendNotification)({
                    receiverId: Number(assignedTo),
                    senderId: uid,
                    type: Notification_1.NotificationType.TASK,
                    title: "New Task Assigned",
                    body: `You have a new task: ${title}`,
                    data: { taskId: String(task.id), event: "task_assigned" },
                });
            }
            catch (err) {
                console.error("createTask socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── GET ALL TASKS ────────────────────────────────────────────────────────
        // client emits: getAllTasks  { status?, priority?, assignedTo?, assignedBy?, page?, limit?, tags?, dateScope? }
        // dateScope ("today" | "history") only applies when status is exactly
        // "completed" — lets the board show "done today" vs a separate task
        // history view without changing default (undated) behavior for every
        // other query (the main kanban board still fetches all statuses at once).
        socket.on("getAllTasks", (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (data = {}) {
            if (!(yield hasPermission(uid, companyId, role, "view"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
            }
            const { status, priority, assignedTo, assignedBy, page = 1, limit: limitQ = 20, tags, dateScope } = data;
            const pageNum = Math.max(1, Number(page));
            const limitNum = Math.min(50, Number(limitQ));
            const offset = (pageNum - 1) * limitNum;
            try {
                const where = { companyId: Number(companyId) };
                // Manager sees the whole company's tasks now, same as admin/user —
                // previously restricted to only tasks they personally created or
                // were assigned, which hid the rest of the team's work from them.
                if (role === "sale_person")
                    where.assignedTo = uid;
                if (status)
                    where.status = status;
                if (priority)
                    where.priority = priority;
                if (tags)
                    where.tags = tags;
                if (assignedTo && role !== "sale_person")
                    where.assignedTo = Number(assignedTo);
                // admin/super_admin/manager can filter by who created/assigned the task
                if (assignedBy && role !== "sale_person")
                    where.assignedBy = Number(assignedBy);
                if (status === "completed" && (dateScope === "today" || dateScope === "history")) {
                    const startOfToday = new Date();
                    startOfToday.setHours(0, 0, 0, 0);
                    const endOfToday = new Date();
                    endOfToday.setHours(23, 59, 59, 999);
                    where.completedAt = dateScope === "today"
                        ? { [sequelize_1.Op.between]: [startOfToday, endOfToday] }
                        : { [sequelize_1.Op.lt]: startOfToday };
                }
                const { count, rows } = yield dbConnection_1.Task.findAndCountAll({
                    where,
                    include: [
                        { model: dbConnection_1.User, as: "assignee", attributes: ["id", "firstName", "lastName", "email", "role"] },
                        { model: dbConnection_1.User, as: "creator", attributes: ["id", "firstName", "lastName", "email", "role"] },
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
            }
            catch (err) {
                console.error("getAllTasks socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── GET TASK BY ID ───────────────────────────────────────────────────────
        // client emits: getTaskById  { id }
        socket.on("getTaskById", (_a) => __awaiter(void 0, [_a], void 0, function* ({ id }) {
            if (!(yield hasPermission(uid, companyId, role, "view"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
            }
            try {
                const where = buildTaskVisibilityWhere(companyId, role, uid, Number(id));
                const task = yield dbConnection_1.Task.findOne({
                    where,
                    include: [
                        { model: dbConnection_1.User, as: "assignee", attributes: ["id", "firstName", "lastName", "email", "role"] },
                        { model: dbConnection_1.User, as: "creator", attributes: ["id", "firstName", "lastName", "email", "role"] },
                    ],
                });
                if (!task)
                    return socket.emit("taskError", { message: "Task not found" });
                socket.emit("taskDetail", { success: true, data: task });
            }
            catch (err) {
                console.error("getTaskById socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── UPDATE TASK ──────────────────────────────────────────────────────────
        // client emits: updateTask  { id, title?, description?, status?, priority?, dueDate?, assignedTo?, tags? }
        // sale_person can only update status of tasks assigned to them
        socket.on("updateTask", (data) => __awaiter(void 0, void 0, void 0, function* () {
            if (!(yield hasPermission(uid, companyId, role, "update"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:update permission" });
            }
            const { id, title, description, status, priority, dueDate, assignedTo, tags } = data;
            try {
                // Manager now gets the same company-wide visibility as admin/user —
                // previously restricted to only tasks they personally created or
                // were assigned, which meant they couldn't manage the rest of the
                // team's tasks despite having task:update.
                const where = buildTaskVisibilityWhere(companyId, role, uid, Number(id));
                const task = yield dbConnection_1.Task.findOne({ where });
                if (!task)
                    return socket.emit("taskError", { message: "Task not found" });
                const prevAssignee = task.assignedTo;
                const prevStatus = task.status;
                const prevPriority = task.priority;
                const prevTitle = task.title;
                const prevDesc = task.description;
                const prevDueDate = task.dueDate;
                const prevTags = task.tags;
                if (role === "sale_person") {
                    if (status !== undefined)
                        task.status = status;
                }
                else {
                    if (assignedTo !== undefined) {
                        const assignee = yield dbConnection_1.User.findByPk(assignedTo, {
                            attributes: ["id", "role", "status", "tenantId"],
                        });
                        if (!assignee || assignee.status !== "active") {
                            return socket.emit("taskError", { message: "Assigned user not found or inactive" });
                        }
                        // Tenant isolation on reassignment
                        if (role !== "super_admin") {
                            const caller = yield dbConnection_1.User.findByPk(uid, { attributes: ["tenantId"] });
                            if ((caller === null || caller === void 0 ? void 0 : caller.tenantId) && caller.tenantId !== assignee.tenantId) {
                                return socket.emit("taskError", { message: "Cannot assign tasks to users outside your tenant" });
                            }
                        }
                        const assigneeRole = assignee.role;
                        if ((role === "admin" || role === "super_admin" || role === "manager") &&
                            !["manager", "sale_person"].includes(assigneeRole)) {
                            return socket.emit("taskError", { message: "Tasks can only be assigned to managers or sale persons" });
                        }
                        task.assignedTo = Number(assignedTo);
                    }
                    if (title !== undefined)
                        task.title = title;
                    if (description !== undefined)
                        task.description = description;
                    if (status !== undefined)
                        task.status = status;
                    if (priority !== undefined)
                        task.priority = priority;
                    if (dueDate !== undefined)
                        task.dueDate = dueDate;
                    if (tags !== undefined)
                        task.tags = tags;
                }
                // Track when a task actually became "completed" — distinguishes
                // "done today" from older completed tasks (task history), which
                // previously had no way to be told apart at all.
                if (status !== undefined && status !== prevStatus) {
                    if (status === "completed")
                        task.completedAt = new Date();
                    else if (prevStatus === "completed")
                        task.completedAt = null;
                }
                yield task.save();
                // Log each changed field
                const historyLogs = [];
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
                if (tags !== undefined && JSON.stringify(prevTags !== null && prevTags !== void 0 ? prevTags : []) !== JSON.stringify(tags !== null && tags !== void 0 ? tags : []))
                    historyLogs.push(logHistory(task.id, uid, "tags", (prevTags !== null && prevTags !== void 0 ? prevTags : []).join(", "), (tags !== null && tags !== void 0 ? tags : []).join(", ")));
                yield Promise.all(historyLogs);
                const payload = task.toJSON();
                broadcast("taskUpdated", payload, task.assignedTo ? Number(task.assignedTo) : undefined);
                // Also notify previous assignee if task was reassigned
                if (assignedTo !== undefined &&
                    prevAssignee &&
                    Number(prevAssignee) !== Number(assignedTo)) {
                    io.to(`task:user:${prevAssignee}`).emit("taskUpdated", payload);
                    yield (0, notificationService_1.sendNotification)({
                        receiverId: Number(assignedTo),
                        senderId: uid,
                        type: Notification_1.NotificationType.TASK,
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
                    const recipients = new Set();
                    if (task.assignedBy && Number(task.assignedBy) !== uid)
                        recipients.add(Number(task.assignedBy));
                    const directCreator = yield (0, userHierarchy_1.getDirectCreator)(uid);
                    if (directCreator && directCreator.id !== uid)
                        recipients.add(directCreator.id);
                    yield Promise.all(Array.from(recipients).map((receiverId) => (0, notificationService_1.sendNotification)({
                        receiverId,
                        senderId: uid,
                        type: Notification_1.NotificationType.TASK,
                        title: "Task Completed",
                        body: `"${task.title}" was marked completed.`,
                        data: { taskId: String(task.id), event: "task_completed" },
                    })));
                }
            }
            catch (err) {
                console.error("updateTask socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── GET TASK HISTORY ─────────────────────────────────────────────────────
        // client emits: getTaskHistory  { id }              → one task's audit trail (unchanged behavior)
        // client emits: getTaskHistory  { page?, limit? }    → company-wide activity feed, paginated
        // (no id) — previously this second mode didn't actually exist: the
        // frontend's "Global Activity Feed" called getTaskHistory({}), which
        // silently resolved to `taskId: NaN` and always returned an empty list.
        socket.on("getTaskHistory", (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (data = {}) {
            if (!(yield hasPermission(uid, companyId, role, "view"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
            }
            const { id } = data;
            try {
                if (id !== undefined) {
                    const where = buildTaskVisibilityWhere(companyId, role, uid, Number(id));
                    const task = yield dbConnection_1.Task.findOne({ where, attributes: ["id"] });
                    if (!task)
                        return socket.emit("taskError", { message: "Task not found" });
                    const history = yield dbConnection_1.TaskHistory.findAll({
                        where: { taskId: Number(id) },
                        include: [
                            { model: dbConnection_1.User, as: "changedByUser", attributes: ["id", "firstName", "lastName", "email", "role"] },
                        ],
                        order: [["createdAt", "ASC"]],
                    });
                    return socket.emit("taskHistory", { success: true, taskId: Number(id), data: history });
                }
                // Global mode — company-wide (or own-tasks-only for sale_person),
                // paginated, newest first.
                const { page = 1, limit: limitQ = 20 } = data;
                const pageNum = Math.max(1, Number(page));
                const limitNum = Math.min(50, Number(limitQ));
                const offset = (pageNum - 1) * limitNum;
                const taskWhere = buildTaskVisibilityWhere(companyId, role, uid);
                const { count, rows } = yield dbConnection_1.TaskHistory.findAndCountAll({
                    include: [
                        { model: dbConnection_1.Task, as: "task", where: taskWhere, attributes: ["id", "title"], required: true },
                        { model: dbConnection_1.User, as: "changedByUser", attributes: ["id", "firstName", "lastName", "email", "role"] },
                    ],
                    order: [["createdAt", "DESC"]],
                    limit: limitNum,
                    offset,
                });
                socket.emit("taskHistory", {
                    success: true,
                    total: count,
                    totalPages: Math.ceil(count / limitNum),
                    currentPage: pageNum,
                    data: rows,
                });
            }
            catch (err) {
                console.error("getTaskHistory socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── DELETE TASK ──────────────────────────────────────────────────────────
        // client emits: deleteTask  { id }
        socket.on("deleteTask", (_a) => __awaiter(void 0, [_a], void 0, function* ({ id }) {
            if (!(yield hasPermission(uid, companyId, role, "delete"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:delete permission" });
            }
            try {
                const where = { id, companyId: Number(companyId) };
                if (role === "manager")
                    where.assignedBy = uid;
                const task = yield dbConnection_1.Task.findOne({ where });
                if (!task)
                    return socket.emit("taskError", { message: "Task not found" });
                const assignedToId = task.assignedTo;
                yield task.destroy();
                broadcast("taskDeleted", { id: Number(id) }, assignedToId ? Number(assignedToId) : undefined);
            }
            catch (err) {
                console.error("deleteTask socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── GET TASK COMMENTS ────────────────────────────────────────────────────
        // client emits: getTaskComments  { taskId }
        socket.on("getTaskComments", (_a) => __awaiter(void 0, [_a], void 0, function* ({ taskId }) {
            if (!(yield hasPermission(uid, companyId, role, "view"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
            }
            try {
                const where = buildTaskVisibilityWhere(companyId, role, uid, Number(taskId));
                const task = yield dbConnection_1.Task.findOne({ where, attributes: ["id"] });
                if (!task)
                    return socket.emit("taskError", { message: "Task not found" });
                const comments = yield dbConnection_1.TaskComment.findAll({
                    where: { taskId: Number(taskId) },
                    include: [{ model: dbConnection_1.User, as: "author", attributes: ["id", "firstName", "lastName", "email", "role"] }],
                    order: [["createdAt", "ASC"]],
                });
                socket.emit("taskComments", { success: true, taskId: Number(taskId), data: comments });
            }
            catch (err) {
                console.error("getTaskComments socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── ADD TASK COMMENT ─────────────────────────────────────────────────────
        // client emits: addTaskComment  { taskId, body }
        // Commenting only requires being able to see the task (same bar Jira
        // uses — anyone who can view a ticket can comment on it), not
        // task:update, which stays reserved for actually changing fields.
        socket.on("addTaskComment", (_a) => __awaiter(void 0, [_a], void 0, function* ({ taskId, body }) {
            if (!(yield hasPermission(uid, companyId, role, "view"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
            }
            const trimmedBody = typeof body === "string" ? body.trim() : "";
            if (!taskId || !trimmedBody) {
                return socket.emit("taskError", { message: "taskId and a non-empty body are required" });
            }
            try {
                const where = buildTaskVisibilityWhere(companyId, role, uid, Number(taskId));
                const task = yield dbConnection_1.Task.findOne({ where });
                if (!task)
                    return socket.emit("taskError", { message: "Task not found" });
                const comment = yield dbConnection_1.TaskComment.create({ taskId: Number(taskId), userId: uid, body: trimmedBody });
                const author = yield dbConnection_1.User.findByPk(uid, { attributes: ["id", "firstName", "lastName", "email", "role"] });
                const payload = Object.assign(Object.assign({}, comment.toJSON()), { author });
                io.to(`task:company:${companyId}`).emit("taskCommentAdded", payload);
                if (task.assignedTo)
                    io.to(`task:user:${task.assignedTo}`).emit("taskCommentAdded", payload);
                const recipients = new Set();
                if (task.assignedTo && Number(task.assignedTo) !== uid)
                    recipients.add(Number(task.assignedTo));
                if (task.assignedBy && Number(task.assignedBy) !== uid)
                    recipients.add(Number(task.assignedBy));
                yield Promise.all(Array.from(recipients).map((receiverId) => (0, notificationService_1.sendNotification)({
                    receiverId,
                    senderId: uid,
                    type: Notification_1.NotificationType.TASK,
                    title: "New Comment",
                    body: `${(author === null || author === void 0 ? void 0 : author.firstName) || "Someone"} commented on "${task.title}"`,
                    data: { taskId: String(task.id), event: "task_comment_added" },
                })));
            }
            catch (err) {
                console.error("addTaskComment socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
    });
};
exports.initTaskSocket = initTaskSocket;
