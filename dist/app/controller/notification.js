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
exports.getUnreadCount = exports.clearAllNotifications = exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const dbConnection_1 = require("../../config/dbConnection");
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications
// Returns paginated list of notifications for the logged-in user.
// ─────────────────────────────────────────────────────────────────────────────
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const userId = userData.userId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const offset = (page - 1) * limit;
        const unreadOnly = req.query.unreadOnly === "true";
        const where = { receiverId: userId };
        if (unreadOnly)
            where.isRead = false;
        const { count, rows } = yield dbConnection_1.Notification.findAndCountAll({
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
                : yield dbConnection_1.Notification.count({ where: { receiverId: userId, isRead: false } }),
            data: rows,
        });
    }
    catch (error) {
        console.error("getNotifications error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.getNotifications = getNotifications;
// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// Marks a single notification as read.
// ─────────────────────────────────────────────────────────────────────────────
const markAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const userId = userData.userId;
        const { id } = req.params;
        const notification = yield dbConnection_1.Notification.findOne({
            where: { id, receiverId: userId },
        });
        if (!notification) {
            res.status(404).json({ success: false, message: "Notification not found" });
            return;
        }
        notification.isRead = true;
        yield notification.save();
        res.status(200).json({ success: true, message: "Marked as read", data: notification });
    }
    catch (error) {
        console.error("markAsRead error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.markAsRead = markAsRead;
// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// Marks ALL notifications of the logged-in user as read.
// ─────────────────────────────────────────────────────────────────────────────
const markAllAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const userId = userData.userId;
        yield dbConnection_1.Notification.update({ isRead: true }, { where: { receiverId: userId, isRead: false } });
        res.status(200).json({ success: true, message: "All notifications marked as read" });
    }
    catch (error) {
        console.error("markAllAsRead error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.markAllAsRead = markAllAsRead;
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/:id
// Deletes a single notification (only if it belongs to the logged-in user).
// ─────────────────────────────────────────────────────────────────────────────
const deleteNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const userId = userData.userId;
        const { id } = req.params;
        const deleted = yield dbConnection_1.Notification.destroy({
            where: { id, receiverId: userId },
        });
        if (!deleted) {
            res.status(404).json({ success: false, message: "Notification not found" });
            return;
        }
        res.status(200).json({ success: true, message: "Notification deleted" });
    }
    catch (error) {
        console.error("deleteNotification error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.deleteNotification = deleteNotification;
// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notifications/clear-all
// Deletes ALL notifications of the logged-in user.
// ─────────────────────────────────────────────────────────────────────────────
const clearAllNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const userId = userData.userId;
        yield dbConnection_1.Notification.destroy({ where: { receiverId: userId } });
        res.status(200).json({ success: true, message: "All notifications cleared" });
    }
    catch (error) {
        console.error("clearAllNotifications error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.clearAllNotifications = clearAllNotifications;
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/notifications/unread-count
// Quick count endpoint for badge display.
// ─────────────────────────────────────────────────────────────────────────────
const getUnreadCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userData = req.userData;
        const userId = userData.userId;
        const count = yield dbConnection_1.Notification.count({
            where: { receiverId: userId, isRead: false },
        });
        res.status(200).json({ success: true, unreadCount: count });
    }
    catch (error) {
        console.error("getUnreadCount error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.getUnreadCount = getUnreadCount;
