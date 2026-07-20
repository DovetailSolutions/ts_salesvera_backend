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
exports.sendNotification = exports.isUserOnline = exports.removeUserSocket = exports.setUserSocket = exports.registerIo = void 0;
const Notification_1 = require("../app/model/Notification");
const dbConnection_1 = require("../config/dbConnection");
const Notification_2 = require("./Notification");
// ─────────────────────────────────────────────────────────────────────────────
// 📡  Socket.io instance registry
// ─────────────────────────────────────────────────────────────────────────────
let _io = null;
const registerIo = (io) => {
    _io = io;
};
exports.registerIo = registerIo;
// ─────────────────────────────────────────────────────────────────────────────
// 🗂️  In-memory userId → Set<socketId> map (Supports multiple devices)
// ─────────────────────────────────────────────────────────────────────────────
const userSocketMap = new Map();
const setUserSocket = (userId, socketId) => {
    // 🔐 SAFETY: Remove this specific socketId from ANY other user (Prevention of socket reuse leaks)
    userSocketMap.forEach((sockets, uid) => {
        if (sockets.has(socketId)) {
            sockets.delete(socketId);
            if (sockets.size === 0)
                userSocketMap.delete(uid);
        }
    });
    if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId).add(socketId);
};
exports.setUserSocket = setUserSocket;
/**
 * Removes a specific socket.
 * Returns true if this was the LAST socket for the user (user is now fully offline).
 */
const removeUserSocket = (userId, socketId) => {
    const sockets = userSocketMap.get(userId);
    if (sockets) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
            userSocketMap.delete(userId);
            return true; // Last socket gone
        }
    }
    return false;
};
exports.removeUserSocket = removeUserSocket;
const isUserOnline = (userId) => {
    return userSocketMap.has(userId) && userSocketMap.get(userId).size > 0;
};
exports.isUserOnline = isUserOnline;
const sendNotification = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { senderId = null, type = Notification_1.NotificationType.SYSTEM, title, body, data = {}, } = payload;
    const receiverId = Number(payload.receiverId);
    try {
        // 1️⃣ Persist to DB
        const notification = yield Notification_1.Notification.create({
            receiverId,
            senderId,
            type,
            title,
            body,
            data,
            isRead: false,
        });
        const eventPayload = {
            id: notification.id,
            receiverId,
            senderId,
            type,
            title,
            body,
            data,
            isRead: false,
            createdAt: notification.createdAt,
        };
        // 2️⃣ Real-time delivery via socket.io
        if (_io) {
            const receiverSockets = userSocketMap.get(receiverId);
            if (receiverSockets) {
                receiverSockets.forEach((sid) => {
                    _io === null || _io === void 0 ? void 0 : _io.to(sid).emit("notification", eventPayload);
                });
            }
        }
        // 3️⃣ Real-time delivery via Firebase
        try {
            const devices = yield dbConnection_1.Device.findAll({
                where: { userId: receiverId, isActive: true }
            });
            if (devices.length > 0) {
                const tokens = devices.map(d => d.deviceToken).filter(t => !!t);
                if (tokens.length > 0) {
                    const firebaseData = {};
                    Object.entries(data).forEach(([key, value]) => {
                        firebaseData[key] = String(value);
                    });
                    firebaseData.notificationId = String(notification.id);
                    firebaseData.type = type;
                    yield (0, Notification_2.sendPushNotification)({
                        token: tokens,
                        title,
                        body,
                        data: firebaseData,
                    });
                }
            }
        }
        catch (pushError) {
            console.error("⚠️ Push Notification failed:", pushError);
        }
    }
    catch (error) {
        console.error("❌ sendNotification error:", error);
    }
});
exports.sendNotification = sendNotification;
