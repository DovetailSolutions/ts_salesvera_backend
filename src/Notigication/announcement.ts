import { Server } from "socket.io";

// ============================================================
// Announcement socket delivery — no client-emitted events, creation is
// REST-only (see modules/announcement/announcement.routes.ts). This file
// exists purely to hold the io reference for post-commit emission,
// following the one-file-per-domain convention (chat.ts, task.ts).
//
// No new io.use() middleware is registered here: chat.ts's existing auth
// middleware already authenticates every socket and joins it to
// `user_${userId}` on connect, which is the only room emitAnnouncementCreated
// needs — reusing it is what keeps this feature from opening a second
// socket connection or a second auth path.
// ============================================================
let _io: Server | null = null;

export const initAnnouncementSocket = (io: Server): void => {
  _io = io;
};

export const emitAnnouncementCreated = (recipientIds: number[], payload: Record<string, any>): void => {
  if (!_io) return;
  recipientIds.forEach((id) => {
    _io!.to(`user_${id}`).emit("announcementCreated", payload);
  });
};
