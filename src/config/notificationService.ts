import { Server } from "socket.io";
import { Notification, NotificationType } from "../app/model/Notification";
import { Device } from "../config/dbConnection";
import { sendPushNotification } from "./Notification";

// ─────────────────────────────────────────────────────────────────────────────
// 📡  Socket.io instance registry
//     Populated by server.ts once io is created.
// ─────────────────────────────────────────────────────────────────────────────
let _io: Server | null = null;

/** Call this once after creating your socket.io Server instance. */
export const registerIo = (io: Server) => {
  _io = io;
};

// ─────────────────────────────────────────────────────────────────────────────
// 🗂️  In-memory userId → socketId map
//     Updated from the chat socket whenever a user connects / disconnects.
// ─────────────────────────────────────────────────────────────────────────────
const userSocketMap = new Map<number, string>();

export const setUserSocket = (userId: number, socketId: string) => {
  userSocketMap.set(userId, socketId);
};

export const removeUserSocket = (userId: number) => {
  userSocketMap.delete(userId);
};

// ─────────────────────────────────────────────────────────────────────────────
// 📤  Payload accepted by sendNotification
// ─────────────────────────────────────────────────────────────────────────────
export interface NotificationPayload {
  receiverId: number;          // target user
  senderId?: number | null;    // who triggered it (omit for system messages)
  type?: NotificationType | string; // Use enum for strict typing, but allow string for backwards compatibility
  title: string;
  body: string;
  data?: Record<string, any>;  // any extra data the client needs
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔔  Main utility function
//     1. Saves notification to DB
//     2. Pushes via socket.io to online receiver (if connected)
//     3. Pushes via Firebase Cloud Messaging (FCM) to all registered devices
// ─────────────────────────────────────────────────────────────────────────────
export const sendNotification = async (payload: NotificationPayload): Promise<void> => {
  const {
    senderId = null,
    type = NotificationType.SYSTEM,
    title,
    body,
    data = {},
  } = payload;
  const receiverId = Number(payload.receiverId); // ✅ Extra safety cast



  try {
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


    // 2️⃣ Real-time delivery via socket.io (Socket only)
    if (_io) {
      const receiverSocketId = userSocketMap.get(receiverId);

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
      
      } 
    }

    // 3️⃣ Real-time delivery via Firebase (Push Notification)
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
      console.error("⚠️ Push Notification failed but continuing:", pushError);
    }

   
  } catch (error) {
    console.error("❌ sendNotification error:", error);
    
  }
};
