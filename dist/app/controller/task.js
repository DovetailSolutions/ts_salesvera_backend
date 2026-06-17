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
exports.deleteTask = exports.updateTask = exports.getTaskById = exports.getAllTasks = exports.createTask = void 0;
const dbConnection_1 = require("../../config/dbConnection");
// ─── helpers ─────────────────────────────────────────────────────────────────
const getUser = (req) => req.userData;
// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/task/create
// Admin → can assign to manager or sale_person
// Manager → can assign to sale_person only
// ─────────────────────────────────────────────────────────────────────────────
const createTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, role, companyId } = getUser(req);
        const { title, description, priority, dueDate, assignedTo, tags } = req.body;
        if (!title || !assignedTo) {
            res.status(400).json({ success: false, message: "title and assignedTo are required" });
            return;
        }
        // Validate assignee exists
        const assignee = yield dbConnection_1.User.findByPk(assignedTo, {
            attributes: ["id", "role", "status", "tenantId"],
        });
        if (!assignee || assignee.status !== "active") {
            res.status(404).json({ success: false, message: "Assigned user not found or inactive" });
            return;
        }
        // Tenant isolation: cannot assign tasks across tenant boundaries
        if (role !== "super_admin") {
            const caller = yield dbConnection_1.User.findByPk(userId, { attributes: ["tenantId"] });
            if ((caller === null || caller === void 0 ? void 0 : caller.tenantId) && caller.tenantId !== assignee.tenantId) {
                res.status(403).json({ success: false, message: "Cannot assign tasks to users outside your tenant" });
                return;
            }
        }
        const assigneeRole = assignee.role;
        // Role-based restriction on who can be assigned
        if (role === "manager" && assigneeRole !== "sale_person") {
            res.status(403).json({
                success: false,
                message: "Managers can only assign tasks to sale persons",
            });
            return;
        }
        if ((role === "admin" || role === "super_admin") &&
            !["manager", "sale_person"].includes(assigneeRole)) {
            res.status(403).json({
                success: false,
                message: "Tasks can only be assigned to managers or sale persons",
            });
            return;
        }
        const task = yield dbConnection_1.Task.create({
            title,
            description,
            priority: priority !== null && priority !== void 0 ? priority : "medium",
            dueDate: dueDate !== null && dueDate !== void 0 ? dueDate : undefined,
            assignedTo: Number(assignedTo),
            assignedBy: userId,
            companyId: companyId,
            tags: tags !== null && tags !== void 0 ? tags : null,
        });
        res.status(201).json({ success: true, message: "Task created", data: task });
    }
    catch (error) {
        console.error("createTask error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.createTask = createTask;
// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/task/list
// Admin → all tasks for their company
// Manager → tasks they created
// ─────────────────────────────────────────────────────────────────────────────
const getAllTasks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, role, companyId } = getUser(req);
        const { status, priority, assignedTo, page, limit: limitQ, tags } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, parseInt(limitQ) || 20);
        const offset = (pageNum - 1) * limitNum;
        const where = { companyId };
        if (role === "manager") {
            where.assignedBy = userId;
        }
        if (status)
            where.status = status;
        if (priority)
            where.priority = priority;
        if (assignedTo)
            where.assignedTo = Number(assignedTo);
        if (tags)
            where.tags = tags;
        const { count, rows } = yield dbConnection_1.Task.findAndCountAll({
            where,
            include: [
                {
                    model: dbConnection_1.User,
                    as: "assignee",
                    attributes: ["id", "firstName", "lastName", "email", "role"],
                },
                {
                    model: dbConnection_1.User,
                    as: "creator",
                    attributes: ["id", "firstName", "lastName", "email", "role"],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit: limitNum,
            offset,
        });
        res.status(200).json({
            success: true,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            currentPage: pageNum,
            data: rows,
        });
    }
    catch (error) {
        console.error("getAllTasks error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.getAllTasks = getAllTasks;
// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/task/:id
// ─────────────────────────────────────────────────────────────────────────────
const getTaskById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, role, companyId } = getUser(req);
        const { id } = req.params;
        const where = { id, companyId };
        if (role === "manager")
            where.assignedBy = userId;
        const task = yield dbConnection_1.Task.findOne({
            where,
            include: [
                { model: dbConnection_1.User, as: "assignee", attributes: ["id", "firstName", "lastName", "email", "role"] },
                { model: dbConnection_1.User, as: "creator", attributes: ["id", "firstName", "lastName", "email", "role"] },
            ],
        });
        if (!task) {
            res.status(404).json({ success: false, message: "Task not found" });
            return;
        }
        res.status(200).json({ success: true, data: task });
    }
    catch (error) {
        console.error("getTaskById error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.getTaskById = getTaskById;
// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/task/update/:id
// Admin → can update any task in their company
// Manager → can update only tasks they created
// ─────────────────────────────────────────────────────────────────────────────
const updateTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, role, companyId } = getUser(req);
        const { id } = req.params;
        const { title, description, status, priority, dueDate, assignedTo } = req.body;
        const where = { id, companyId };
        if (role === "manager")
            where.assignedBy = userId;
        const task = yield dbConnection_1.Task.findOne({ where });
        if (!task) {
            res.status(404).json({ success: false, message: "Task not found" });
            return;
        }
        // If reassigning, validate new assignee
        if (assignedTo !== undefined) {
            const assignee = yield dbConnection_1.User.findByPk(assignedTo, {
                attributes: ["id", "role", "status", "tenantId"],
            });
            if (!assignee || assignee.status !== "active") {
                res.status(404).json({ success: false, message: "Assigned user not found or inactive" });
                return;
            }
            // Tenant isolation on reassignment
            if (role !== "super_admin") {
                const caller = yield dbConnection_1.User.findByPk(userId, { attributes: ["tenantId"] });
                if ((caller === null || caller === void 0 ? void 0 : caller.tenantId) && caller.tenantId !== assignee.tenantId) {
                    res.status(403).json({ success: false, message: "Cannot assign tasks to users outside your tenant" });
                    return;
                }
            }
            const assigneeRole = assignee.role;
            if (role === "manager" && assigneeRole !== "sale_person") {
                res.status(403).json({ success: false, message: "Managers can only assign tasks to sale persons" });
                return;
            }
            if ((role === "admin" || role === "super_admin") &&
                !["manager", "sale_person"].includes(assigneeRole)) {
                res.status(403).json({ success: false, message: "Tasks can only be assigned to managers or sale persons" });
                return;
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
        yield task.save();
        res.status(200).json({ success: true, message: "Task updated", data: task });
    }
    catch (error) {
        console.error("updateTask error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.updateTask = updateTask;
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/task/delete/:id
// Admin → can delete any task in their company
// Manager → can delete only tasks they created
// ─────────────────────────────────────────────────────────────────────────────
const deleteTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, role, companyId } = getUser(req);
        const { id } = req.params;
        const where = { id, companyId };
        if (role === "manager")
            where.assignedBy = userId;
        const deleted = yield dbConnection_1.Task.destroy({ where });
        if (!deleted) {
            res.status(404).json({ success: false, message: "Task not found" });
            return;
        }
        res.status(200).json({ success: true, message: "Task deleted" });
    }
    catch (error) {
        console.error("deleteTask error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.deleteTask = deleteTask;
