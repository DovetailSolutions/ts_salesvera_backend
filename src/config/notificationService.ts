import { Server } from "socket.io";
import { Notification } from "../app/model/Notification";

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
  type?: string;               // "chat" | "meeting" | "task" | "system" | any
  title: string;
  body: string;
  data?: Record<string, any>;  // any extra data the client needs
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔔  Main utility function
//     1. Saves notification to DB
//     2. Pushes via socket.io to online receiver (if connected)
// ─────────────────────────────────────────────────────────────────────────────
export const sendNotification = async (payload: NotificationPayload): Promise<void> => {
  const {
    receiverId,
    senderId = null,
    type = "system",
    title,
    body,
    data = {},
  } = payload;

  console.log("--------------------------------------------------");
  console.log("🔔 sendNotification triggered with payload:", JSON.stringify(payload, null, 2));

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
    console.log("✅ Notification saved to DB with ID:", notification.id);

    // 2️⃣ Real-time delivery via socket.io
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
        console.log(`🚀 Notification event emitted successfully.`);
      } else {
        // Receiver is offline → notification is stored in DB, they'll fetch it on next login
        console.log(`📭 User ${receiverId} is offline. Notification stored in DB for later fetch.`);
      }
    } else {
      console.warn("⚠️ Socket.io instance (_io) is not initialized. Skipping real-time delivery.");
    }
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("❌ sendNotification error:", error);
    console.log("--------------------------------------------------");
  }
};
