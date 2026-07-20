import { Server } from "socket.io";
import { Notification, NotificationType } from "../app/model/Notification";
import { Device, User } from "../config/dbConnection";
import { sendPushNotification } from "./Notification";

// Only these three types are individually mutable (Settings module's "My
// Preferences" tab) — system/other notifications (security/account alerts)
// always go through regardless of preference.
const MUTABLE_TYPE_COLUMN: Partial<Record<NotificationType | string, "notifyChat" | "notifyTask" | "notifyMeeting">> = {
  [NotificationType.CHAT]: "notifyChat",
  [NotificationType.TASK]: "notifyTask",
  [NotificationType.MEETING]: "notifyMeeting",
};

// ─────────────────────────────────────────────────────────────────────────────
// 📡  Socket.io instance registry
// ─────────────────────────────────────────────────────────────────────────────
let _io: Server | null = null;

export const registerIo = (io: Server) => {
  _io = io;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🗂️  In-memory userId → Set<socketId> map (Supports multiple devices)
// ─────────────────────────────────────────────────────────────────────────────
const userSocketMap = new Map<number, Set<string>>();

export const setUserSocket = (userId: number, socketId: string) => {
  // 🔐 SAFETY: Remove this specific socketId from ANY other user (Prevention of socket reuse leaks)
  userSocketMap.forEach((sockets, uid) => {
    if (sockets.has(socketId)) {
      sockets.delete(socketId);
      if (sockets.size === 0) userSocketMap.delete(uid);
    }
  });

  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId)!.add(socketId);
};

/** 
 * Removes a specific socket. 
 * Returns true if this was the LAST socket for the user (user is now fully offline).
 */
export const removeUserSocket = (userId: number, socketId: string): boolean => {
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

export const isUserOnline = (userId: number): boolean => {
  return userSocketMap.has(userId) && userSocketMap.get(userId)!.size > 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// 📤  Notification Logic
// ─────────────────────────────────────────────────────────────────────────────
export interface NotificationPayload {
  receiverId: number;
  senderId?: number | null;
  type?: NotificationType | string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export const sendNotification = async (payload: NotificationPayload): Promise<void> => {
  const {
    senderId = null,
    type = NotificationType.SYSTEM,
    title,
    body,
    data = {},
  } = payload;
  const receiverId = Number(payload.receiverId);

  try {
    // 0️⃣ Respect the receiver's mute preference, if this type is mutable —
    // skipped entirely (not persisted, not delivered) rather than just
    // silencing real-time delivery, so a muted type doesn't quietly pile up
    // unread in their notification bell either.
    const prefColumn = MUTABLE_TYPE_COLUMN[type];
    if (prefColumn) {
      const receiver = await User.findByPk(receiverId, { attributes: [prefColumn] });
      if (receiver && (receiver as any)[prefColumn] === false) return;
    }

    // 1️⃣ Persist to DB
    const notification = await Notification.create({
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
          _io?.to(sid).emit("notification", eventPayload);
        });
      }
    }

    // 3️⃣ Real-time delivery via Firebase
    try {
      const devices = await Device.findAll({
        where: { userId: receiverId, isActive: true }
      });

      if (devices.length > 0) {
        const tokens = devices.map(d => d.deviceToken).filter(t => !!t);
        if (tokens.length > 0) {
          const firebaseData: Record<string, string> = {};
          Object.entries(data).forEach(([key, value]) => {
            firebaseData[key] = String(value);
          });
          firebaseData.notificationId = String(notification.id);
          firebaseData.type = type;

          await sendPushNotification({
            token: tokens,
            title,
            body,
            data: firebaseData,
          });
        }
      } 
    } catch (pushError) {
      console.error("⚠️ Push Notification failed:", pushError);
    }
  } catch (error) {
    console.error("❌ sendNotification error:", error);
  }
};
