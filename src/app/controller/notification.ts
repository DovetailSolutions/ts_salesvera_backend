import { Request, Response } from "express";
import { Notification } from "../../config/dbConnection";
import { Op } from "sequelize";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications
// Returns paginated list of notifications for the logged-in user.
// ─────────────────────────────────────────────────────────────────────────────
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(50, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unreadOnly === "true";

    const where: any = { receiverId: userId };
    if (unreadOnly) where.isRead = false;

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      unreadCount: unreadOnly
        ? count
        : await Notification.count({ where: { receiverId: userId, isRead: false } }),
      data: rows,
    });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// Marks a single notification as read.
// ─────────────────────────────────────────────────────────────────────────────
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, receiverId: userId },
    });

    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, message: "Marked as read", data: notification });
  } catch (error) {
    console.error("markAsRead error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Marks ALL notifications of the logged-in user as read.
// ─────────────────────────────────────────────────────────────────────────────
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    await Notification.update(
      { isRead: true },
      { where: { receiverId: userId, isRead: false } }
    );

    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("markAllAsRead error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
// Deletes a single notification (only if it belongs to the logged-in user).
// ─────────────────────────────────────────────────────────────────────────────
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    const deleted = await Notification.destroy({
      where: { id, receiverId: userId },
    });

    if (!deleted) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("deleteNotification error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/clear-all
// Deletes ALL notifications of the logged-in user.
// ─────────────────────────────────────────────────────────────────────────────
export const clearAllNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    await Notification.destroy({ where: { receiverId: userId } });

    res.status(200).json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    console.error("clearAllNotifications error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications/unread-count
// Quick count endpoint for badge display.
// ─────────────────────────────────────────────────────────────────────────────
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const count = await Notification.count({
      where: { receiverId: userId, isRead: false },
    });

    res.status(200).json({ success: true, unreadCount: count });
  } catch (error) {
    console.error("getUnreadCount error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
