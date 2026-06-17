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
const Notification_1 = require("../config/Notification");
const permissionCache_1 = require("../config/permissionCache");
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
// ─── Push notification to a user's registered devices ────────────────────────
const pushToUser = (userId_1, title_1, body_1, ...args_1) => __awaiter(void 0, [userId_1, title_1, body_1, ...args_1], void 0, function* (userId, title, body, data = {}) {
    try {
        const devices = yield dbConnection_1.Device.findAll({ where: { userId, isActive: true } });
        const tokens = devices.map((d) => d.deviceToken).filter(Boolean);
        if (tokens.length > 0) {
            yield (0, Notification_1.sendPushNotification)({ token: tokens, title, body, data });
        }
    }
    catch (err) {
        console.error("task push error:", err);
    }
});
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
                if (role === "manager" && assigneeRole !== "sale_person") {
                    return socket.emit("taskError", { message: "Managers can only assign tasks to sale persons" });
                }
                if ((role === "admin" || role === "super_admin") &&
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
                yield pushToUser(Number(assignedTo), "New Task Assigned", `You have a new task: ${title}`, {
                    taskId: String(task.id),
                    type: "task_assigned",
                });
            }
            catch (err) {
                console.error("createTask socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── GET ALL TASKS ────────────────────────────────────────────────────────
        // client emits: getAllTasks  { status?, priority?, assignedTo?, assignedBy?, page?, limit?, tags? }
        socket.on("getAllTasks", (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (data = {}) {
            if (!(yield hasPermission(uid, companyId, role, "view"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
            }
            const { status, priority, assignedTo, assignedBy, page = 1, limit: limitQ = 20, tags } = data;
            const pageNum = Math.max(1, Number(page));
            const limitNum = Math.min(50, Number(limitQ));
            const offset = (pageNum - 1) * limitNum;
            try {
                const where = { companyId: Number(companyId) };
                if (role === "manager")
                    where[sequelize_1.Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];
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
                // admin/super_admin can filter by who created/assigned the task
                if (assignedBy && (role === "admin" || role === "super_admin"))
                    where.assignedBy = Number(assignedBy);
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
                //  companyId: Number(companyId)
                const where = { id };
                if (role === "manager")
                    where[sequelize_1.Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];
                if (role === "sale_person")
                    where.assignedTo = uid;
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
        // client emits: updateTask  { id, title?, description?, status?, priority?, dueDate?, assignedTo? }
        // sale_person can only update status of tasks assigned to them
        socket.on("updateTask", (data) => __awaiter(void 0, void 0, void 0, function* () {
            if (!(yield hasPermission(uid, companyId, role, "update"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:update permission" });
            }
            const { id, title, description, status, priority, dueDate, assignedTo } = data;
            try {
                const where = { id };
                if (role === "manager")
                    where[sequelize_1.Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];
                if (role === "sale_person")
                    where[sequelize_1.Op.or] = [{ assignedBy: uid }, { assignedTo: uid }];
                const task = yield dbConnection_1.Task.findOne({ where });
                if (!task)
                    return socket.emit("taskError", { message: "Task not found" });
                const prevAssignee = task.assignedTo;
                const prevStatus = task.status;
                const prevPriority = task.priority;
                const prevTitle = task.title;
                const prevDesc = task.description;
                const prevDueDate = task.dueDate;
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
                        if (role === "manager" && assigneeRole !== "sale_person") {
                            return socket.emit("taskError", { message: "Managers can only assign tasks to sale persons" });
                        }
                        if ((role === "admin" || role === "super_admin") &&
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
                yield Promise.all(historyLogs);
                const payload = task.toJSON();
                broadcast("taskUpdated", payload, task.assignedTo ? Number(task.assignedTo) : undefined);
                // Also notify previous assignee if task was reassigned
                if (assignedTo !== undefined &&
                    prevAssignee &&
                    Number(prevAssignee) !== Number(assignedTo)) {
                    io.to(`task:user:${prevAssignee}`).emit("taskUpdated", payload);
                    yield pushToUser(Number(assignedTo), "Task Reassigned", `Task updated: ${task.title}`, {
                        taskId: String(task.id),
                        type: "task_updated",
                    });
                }
            }
            catch (err) {
                console.error("updateTask socket error:", err);
                socket.emit("taskError", { message: "Internal server error" });
            }
        }));
        // ── GET TASK HISTORY ─────────────────────────────────────────────────────
        // client emits: getTaskHistory  { id }
        // Returns the full audit trail for a task (Jira-like activity log)
        socket.on("getTaskHistory", (_a) => __awaiter(void 0, [_a], void 0, function* ({ id }) {
            if (!(yield hasPermission(uid, companyId, role, "view"))) {
                return socket.emit("taskError", { message: "Forbidden — you do not have task:view permission" });
            }
            try {
                const where = { id, companyId: Number(companyId) };
                if (role === "manager")
                    where.assignedBy = uid;
                if (role === "sale_person")
                    where.assignedTo = uid;
                const task = yield dbConnection_1.Task.findOne({ where, attributes: ["id"] });
                if (!task)
                    return socket.emit("taskError", { message: "Task not found" });
                const history = yield dbConnection_1.TaskHistory.findAll({
                    where: { taskId: Number(id) },
                    include: [
                        {
                            model: dbConnection_1.User,
                            as: "changedByUser",
                            attributes: ["id", "firstName", "lastName", "email", "role"],
                        },
                    ],
                    order: [["createdAt", "ASC"]],
                });
                socket.emit("taskHistory", { success: true, taskId: Number(id), data: history });
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
    });
};
exports.initTaskSocket = initTaskSocket;
