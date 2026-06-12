import { Request, Response } from "express";
import { JwtPayload } from "jsonwebtoken";
import { Op } from "sequelize";
import { Task, User } from "../../config/dbConnection";

// ─── helpers ─────────────────────────────────────────────────────────────────

const getUser = (req: Request) => (req as any).userData as JwtPayload;

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/task/create
// Admin → can assign to manager or sale_person
// Manager → can assign to sale_person only
// ─────────────────────────────────────────────────────────────────────────────
export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, companyId } = getUser(req);
    const { title, description, priority, dueDate, assignedTo, tags } = req.body;

    if (!title || !assignedTo) {
      res.status(400).json({ success: false, message: "title and assignedTo are required" });
      return;
    }

    // Validate assignee exists
    const assignee = await (User as any).findByPk(assignedTo, {
      attributes: ["id", "role", "status", "tenantId"],
    });

    if (!assignee || assignee.status !== "active") {
      res.status(404).json({ success: false, message: "Assigned user not found or inactive" });
      return;
    }

    // Tenant isolation: cannot assign tasks across tenant boundaries
    if (role !== "super_admin") {
      const caller = await (User as any).findByPk(userId, { attributes: ["tenantId"] });
      if (caller?.tenantId && caller.tenantId !== assignee.tenantId) {
        res.status(403).json({ success: false, message: "Cannot assign tasks to users outside your tenant" });
        return;
      }
    }

    const assigneeRole: string = assignee.role;

    // Role-based restriction on who can be assigned
    if (role === "manager" && assigneeRole !== "sale_person") {
      res.status(403).json({
        success: false,
        message: "Managers can only assign tasks to sale persons",
      });
      return;
    }

    if (
      (role === "admin" || role === "super_admin") &&
      !["manager", "sale_person"].includes(assigneeRole)
    ) {
      res.status(403).json({
        success: false,
        message: "Tasks can only be assigned to managers or sale persons",
      });
      return;
    }

    const task = await Task.create({
      title,
      description,
      priority: priority ?? "medium",
      dueDate: dueDate ?? undefined,
      assignedTo: Number(assignedTo),
      assignedBy: userId,
      companyId: companyId!,
      tags: tags ?? null,
    });

    res.status(201).json({ success: true, message: "Task created", data: task });
  } catch (error) {
    console.error("createTask error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/task/list
// Admin → all tasks for their company
// Manager → tasks they created
// ─────────────────────────────────────────────────────────────────────────────
export const getAllTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, companyId } = getUser(req);
    const { status, priority, assignedTo, page, limit: limitQ , tags} = req.query;

    const pageNum  = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, parseInt(limitQ as string) || 20);
    const offset   = (pageNum - 1) * limitNum;

    const where: any = { companyId };

    if (role === "manager") {
      where.assignedBy = userId;
    }

    if (status)     where.status     = status;
    if (priority)   where.priority   = priority;
    if (assignedTo) where.assignedTo = Number(assignedTo);
    if (tags)       where.tags       = tags;

    const { count, rows } = await Task.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "assignee",
          attributes: ["id", "firstName", "lastName", "email", "role"],
        },
        {
          model: User,
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
  } catch (error) {
    console.error("getAllTasks error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/task/:id
// ─────────────────────────────────────────────────────────────────────────────
export const getTaskById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, companyId } = getUser(req);
    const { id } = req.params;

    const where: any = { id, companyId };
    if (role === "manager") where.assignedBy = userId;

    const task = await Task.findOne({
      where,
      include: [
        { model: User, as: "assignee", attributes: ["id", "firstName", "lastName", "email", "role"] },
        { model: User, as: "creator",  attributes: ["id", "firstName", "lastName", "email", "role"] },
      ],
    });

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error("getTaskById error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/task/update/:id
// Admin → can update any task in their company
// Manager → can update only tasks they created
// ─────────────────────────────────────────────────────────────────────────────
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, companyId } = getUser(req);
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedTo } = req.body;

    const where: any = { id, companyId };
    if (role === "manager") where.assignedBy = userId;

    const task = await Task.findOne({ where });

    if (!task) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    // If reassigning, validate new assignee
    if (assignedTo !== undefined) {
      const assignee = await (User as any).findByPk(assignedTo, {
        attributes: ["id", "role", "status", "tenantId"],
      });

      if (!assignee || assignee.status !== "active") {
        res.status(404).json({ success: false, message: "Assigned user not found or inactive" });
        return;
      }

      // Tenant isolation on reassignment
      if (role !== "super_admin") {
        const caller = await (User as any).findByPk(userId, { attributes: ["tenantId"] });
        if (caller?.tenantId && caller.tenantId !== assignee.tenantId) {
          res.status(403).json({ success: false, message: "Cannot assign tasks to users outside your tenant" });
          return;
        }
      }

      const assigneeRole: string = assignee.role;

      if (role === "manager" && assigneeRole !== "sale_person") {
        res.status(403).json({ success: false, message: "Managers can only assign tasks to sale persons" });
        return;
      }

      if (
        (role === "admin" || role === "super_admin") &&
        !["manager", "sale_person"].includes(assigneeRole)
      ) {
        res.status(403).json({ success: false, message: "Tasks can only be assigned to managers or sale persons" });
        return;
      }

      task.assignedTo = Number(assignedTo);
    }

    if (title !== undefined)       task.title       = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined)      task.status      = status;
    if (priority !== undefined)    task.priority    = priority;
    if (dueDate !== undefined)     task.dueDate     = dueDate;

    await task.save();

    res.status(200).json({ success: true, message: "Task updated", data: task });
  } catch (error) {
    console.error("updateTask error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/task/delete/:id
// Admin → can delete any task in their company
// Manager → can delete only tasks they created
// ─────────────────────────────────────────────────────────────────────────────
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, role, companyId } = getUser(req);
    const { id } = req.params;

    const where: any = { id, companyId };
    if (role === "manager") where.assignedBy = userId;

    const deleted = await Task.destroy({ where });

    if (!deleted) {
      res.status(404).json({ success: false, message: "Task not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    console.error("deleteTask error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
