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
exports.sendNotification = exports.removeUserSocket = exports.setUserSocket = exports.registerIo = void 0;
const Notification_1 = require("../app/model/Notification");
const dbConnection_1 = require("../config/dbConnection");
const Notification_2 = require("./Notification");
// ─────────────────────────────────────────────────────────────────────────────
// 📡  Socket.io instance registry
//     Populated by server.ts once io is created.
// ─────────────────────────────────────────────────────────────────────────────
let _io = null;
/** Call this once after creating your socket.io Server instance. */
const registerIo = (io) => {
    _io = io;
};
exports.registerIo = registerIo;
// ─────────────────────────────────────────────────────────────────────────────
// 🗂️  In-memory userId → socketId map
//     Updated from the chat socket whenever a user connects / disconnects.
// ─────────────────────────────────────────────────────────────────────────────
const userSocketMap = new Map();
const setUserSocket = (userId, socketId) => {
    userSocketMap.set(userId, socketId);
};
exports.setUserSocket = setUserSocket;
const removeUserSocket = (userId) => {
    userSocketMap.delete(userId);
};
exports.removeUserSocket = removeUserSocket;
// ─────────────────────────────────────────────────────────────────────────────
// 🔔  Main utility function
//     1. Saves notification to DB
//     2. Pushes via socket.io to online receiver (if connected)
//     3. Pushes via Firebase Cloud Messaging (FCM) to all registered devices
// ─────────────────────────────────────────────────────────────────────────────
const sendNotification = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { senderId = null, type = "system", title, body, data = {}, } = payload;
    const receiverId = Number(payload.receiverId); // ✅ Extra safety cast
    console.log("--------------------------------------------------");
    console.log("🔔 sendNotification triggered with payload:", JSON.stringify(payload, null, 2));
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
        console.log("✅ Notification saved to DB with ID:", notification.id);
        // 2️⃣ Real-time delivery via socket.io (Socket only)
        if (_io) {
            const receiverSocketId = userSocketMap.get(receiverId);
            console.log(`🔍 Checking socket map for receiverId ${receiverId}:`, receiverSocketId || "NOT_FOUND");
            if (receiverSocketId) {
                // Receiver is online → send directly to their socket
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
                console.log(`📡 Emitting 'notification' event to socket ${receiverSocketId}`);
                _io.to(receiverSocketId).emit("notification", eventPayload);
                console.log(`🚀 Socket event emitted successfully.`);
            }
            else {
                console.log(`📭 User ${receiverId} is offline for socket delivery.`);
            }
        }
        // 3️⃣ Real-time delivery via Firebase (Push Notification)
        try {
            const devices = yield dbConnection_1.Device.findAll({
                where: { userId: receiverId, isActive: true }
            });
            if (devices.length > 0) {
                const tokens = devices.map(d => d.deviceToken).filter(t => !!t);
                if (tokens.length > 0) {
                    console.log(`📱 Sending Firebase Push to ${tokens.length} tokens for user ${receiverId}`);
                    // Flatten data for Firebase (must be strings)
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
            else {
                console.log(`📵 No registered devices found for user ${receiverId}. Skipping push.`);
            }
        }
        catch (pushError) {
            console.error("⚠️ Push Notification failed but continuing:", pushError);
        }
        console.log("--------------------------------------------------");
    }
    catch (error) {
        console.error("❌ sendNotification error:", error);
        console.log("--------------------------------------------------");
    }
});
exports.sendNotification = sendNotification;
