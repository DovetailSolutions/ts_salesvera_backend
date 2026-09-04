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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChatSocket = void 0;
const sequelize_1 = require("sequelize");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbConnection_1 = require("../config/dbConnection");
const permissionCache_1 = require("../config/permissionCache");
const uuid_1 = require("uuid");
const notificationService_1 = require("../config/notificationService");
const spaces_1 = require("../config/spaces");
const userHierarchy_1 = require("../modules/shared/userHierarchy");
const uploadToS3 = (base64Data, fileName, mimeType) => __awaiter(void 0, void 0, void 0, function* () {
    // Strip data URL prefix if Flutter sends "data:image/jpeg;base64,..."
    const raw = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const buffer = Buffer.from(raw, "base64");
    const ext = fileName.split(".").pop() || "bin";
    const key = `salesvera/chat/${(0, uuid_1.v4)()}.${ext}`;
    return (0, spaces_1.uploadBufferToSpaces)(key, buffer, mimeType);
});
// FIX: loads a user's "module:action" permission strings from the DB.
//      Used by the socket permission check below (reuses the same cache as HTTP routes).
const loadUserPermissionsFromDB = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const userPerms = yield dbConnection_1.UserPermission.findAll({
        where: { userId },
        include: [{ model: dbConnection_1.Permission, as: "permission", attributes: ["module", "action"] }],
        attributes: [],
    });
    return userPerms.map((up) => `${up.permission.module}:${up.permission.action}`);
});
function getAllRelatedUserIds(userId_1) {
    return __awaiter(this, arguments, void 0, function* (userId, includeSelf = false) {
        const result = new Set();
        if (includeSelf)
            result.add(userId);
        // 1. Fetch recursively UP (parents) and DOWN (children)
        function fetchRelations(id, direction) {
            return __awaiter(this, void 0, void 0, function* () {
                const processedIds = new Set();
                const queue = [id];
                while (queue.length > 0) {
                    const currentId = queue.shift();
                    if (processedIds.has(currentId))
                        continue;
                    processedIds.add(currentId);
                    const user = (yield dbConnection_1.User.findByPk(currentId, {
                        include: [
                            {
                                model: dbConnection_1.User,
                                as: direction === "children" ? "createdUsers" : "creators",
                                through: { attributes: [] },
                                attributes: ["id"],
                            },
                        ],
                    }));
                    const relations = direction === "children" ? user.createdUsers : user.creators;
                    if (!relations)
                        continue;
                    for (const relation of relations) {
                        if (!result.has(relation.id)) {
                            result.add(relation.id);
                            queue.push(relation.id);
                        }
                    }
                }
            });
        }
        // 2. Fetch Horizontal Peers (Siblings - users created by the same parents)
        function fetchPeers(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const user = (yield dbConnection_1.User.findByPk(id, {
                    include: [
                        {
                            model: dbConnection_1.User,
                            as: "creators",
                            through: { attributes: [] },
                            include: [
                                {
                                    model: dbConnection_1.User,
                                    as: "createdUsers",
                                    through: { attributes: [] },
                                    attributes: ["id"],
                                },
                            ],
                        },
                    ],
                }));
                if (user === null || user === void 0 ? void 0 : user.creators) {
                    for (const creator of user.creators) {
                        if (creator.createdUsers) {
                            for (const peer of creator.createdUsers) {
                                result.add(peer.id);
                            }
                        }
                    }
                }
            });
        }
        // Execute all logic
        yield Promise.all([
            fetchRelations(userId, "children"),
            fetchRelations(userId, "parents"),
            // fetchPeers(userId),
        ]);
        return Array.from(result);
    });
}
// 🟢 sale_person UserList: own admin + own manager + all "cousins"
// (every other sale_person under the same admin, regardless of which manager created them)
function getSalePersonChatUserIds(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const result = new Set();
        // 1. Walk UP: own manager (direct creator) + own admin (root admin/super_admin)
        let currentId = userId;
        let managerId = null;
        let adminId = null;
        let isFirst = true;
        while (true) {
            const currentUser = (yield dbConnection_1.User.findByPk(currentId, {
                include: [
                    {
                        model: dbConnection_1.User,
                        as: "creators",
                        attributes: ["id", "role"],
                        through: { attributes: [] },
                    },
                ],
            }));
            const creator = (_a = currentUser === null || currentUser === void 0 ? void 0 : currentUser.creators) === null || _a === void 0 ? void 0 : _a[0];
            if (isFirst) {
                managerId = (_b = creator === null || creator === void 0 ? void 0 : creator.id) !== null && _b !== void 0 ? _b : null;
                isFirst = false;
            }
            if (!creator)
                break;
            if (creator.role === "admin" || creator.role === "super_admin") {
                adminId = creator.id;
                break;
            }
            currentId = creator.id;
        }
        if (managerId)
            result.add(managerId);
        if (adminId)
            result.add(adminId);
        // 2. Cousins: every sale_person whose creator is a manager under the same admin
        if (adminId) {
            const admin = (yield dbConnection_1.User.findByPk(adminId, {
                include: [
                    {
                        model: dbConnection_1.User,
                        as: "createdUsers",
                        attributes: ["id", "role"],
                        through: { attributes: [] },
                    },
                ],
            }));
            const managerIds = ((admin === null || admin === void 0 ? void 0 : admin.createdUsers) || [])
                .filter((u) => u.role === "manager")
                .map((u) => u.id);
            if (managerIds.length > 0) {
                const salePersons = yield dbConnection_1.User.findAll({
                    where: { role: "sale_person" },
                    attributes: ["id"],
                    include: [
                        {
                            model: dbConnection_1.User,
                            as: "creators",
                            attributes: [],
                            through: { attributes: [] },
                            where: { id: { [sequelize_1.Op.in]: managerIds } },
                        },
                    ],
                });
                salePersons.forEach((sp) => result.add(sp.id));
            }
        }
        return Array.from(result);
    });
}
const initChatSocket = (io) => {
    // ---------- 🔐 AUTH + PERMISSION MIDDLEWARE ----------
    // FIX: connection is rejected if the user lacks chat:read permission.
    //      This blocks the entire chat namespace for users without it —
    //      admin without chat:read cannot connect, so their manager/sale_person
    //      hierarchy cannot receive chat access either.
    io.use((socket, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const token = (((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) || socket.handshake.headers.token);
        // FIX: log token presence/length on every handshake so a client-side
        // "connects but never authenticates" report (e.g. sale_person reconnect
        // sending an empty/stale token) can be diagnosed from server logs alone.
        console.log(`SOCKET: Handshake from ${socket.id} — tokenLen: ${token ? token.length : 0}`);
        if (!token)
            return next(new Error("Authentication error"));
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.user = decoded;
            const { userId, role, companyId } = decoded;
            console.log(`SOCKET: Authenticated ${socket.id} — userId: ${userId}, role: ${role}`);
            // These roles always have chat access — no permission check needed
            const rolesWithChatAccess = ["super_admin", "admin", "manager", "user"];
            if (rolesWithChatAccess.includes(role))
                return next();
            if (!companyId) {
                return next(new Error("Forbidden — no company context in token"));
            }
            // All other roles must have chat:read permission explicitly assigned
            const perms = yield (0, permissionCache_1.getUserPermissionsFromCache)(Number(userId), () => loadUserPermissionsFromDB(Number(userId)));
            if (!perms.has("chat:read")) {
                return next(new Error("You do not have permission for chat"));
            }
            next();
        }
        catch (err) {
            console.log(`SOCKET: Auth failed for ${socket.id} — ${(_b = err === null || err === void 0 ? void 0 : err.message) !== null && _b !== void 0 ? _b : err}`);
            next(new Error("Authentication failed"));
        }
    }));
    io.on("connection", (socket) => __awaiter(void 0, void 0, void 0, function* () {
        const userId = Number(socket.data.user.userId); // ✅ Cast to number
        const userRole = socket.data.user.role;
        console.log(`SOCKET: Connected successfully! socketId: ${socket.id}, userId: ${userId}, role: ${userRole}`);
        // 📡 Register this user's socket for targeted notifications
        (0, notificationService_1.setUserSocket)(userId, socket.id);
        // Join personal user room so real-time messages & group invites are received
        socket.join(`user_${userId}`);
        // Auto-join all chat rooms this user belongs to
        try {
            const participations = yield dbConnection_1.ChatParticipant.findAll({
                where: { userId },
                include: [{ model: dbConnection_1.ChatRoom, attributes: ["roomId"] }],
            });
            participations.forEach((p) => {
                var _a;
                if ((_a = p.ChatRoom) === null || _a === void 0 ? void 0 : _a.roomId) {
                    socket.join(p.ChatRoom.roomId);
                }
            });
        }
        catch (joinErr) {
            console.error("Auto-join rooms error:", joinErr);
        }
        yield dbConnection_1.User.update({ onlineSatus: "online" }, { where: { id: userId } });
        // 📡 Broadcast this user's online status to ALL connected clients
        io.emit("userStatusChange", { userId, onlineSatus: "online" });
        // --------------------------------------------------------
        // 🟦 JOIN ROOM
        // --------------------------------------------------------
        socket.on("joinRoom", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, type = "private", members = [] }) {
            try {
                let room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId } });
                const isNewRoom = !room;
                // 🔥 Create room if not exists
                if (!room) {
                    const newRoomId = roomId || (0, uuid_1.v4)();
                    room = yield dbConnection_1.ChatRoom.create({
                        roomId: newRoomId,
                        type,
                    });
                }
                // Use DB primary key for relations (VERY IMPORTANT)
                const dbRoomId = room.id;
                // Add current user as participant
                const participant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: dbRoomId, userId },
                });
                // FIX: previously any caller could join ANY pre-existing room just
                // by knowing/guessing its roomId — silently becoming a participant
                // with zero authorization check, then reading its history via
                // mychats/receiveMessage indefinitely. Only auto-join a brand-new
                // room (created above), a room the caller is already a member of,
                // or — for private chats — a room whose id is the deterministic
                // `${min(a,b)}-${max(a,b)}` pair for the caller's own userId (see
                // buildRoomId in UserChat.jsx): that's the normal "other party
                // opens the chat first" case, not an authorization gap.
                if (!participant && !isNewRoom) {
                    const pairIds = type === "private" ? String(roomId).split("-").map(Number) : [];
                    const isOwnPrivatePair = type === "private" && pairIds.length === 2 && pairIds.every((n) => Number.isInteger(n)) && pairIds.includes(Number(userId));
                    if (!isOwnPrivatePair) {
                        return socket.emit("errorMessage", { error: "You are not a member of this room." });
                    }
                }
                if (!participant) {
                    yield dbConnection_1.ChatParticipant.create({
                        chatRoomId: dbRoomId,
                        userId,
                    });
                }
                // Group chat → add members (only meaningful when the room was just created)
                if (isNewRoom && type === "group" && members.length > 0) {
                    const bulk = members.map((m) => ({
                        chatRoomId: dbRoomId,
                        userId: m,
                    }));
                    yield dbConnection_1.ChatParticipant.bulkCreate(bulk, {
                        ignoreDuplicates: true,
                    });
                }
                socket.join(room.roomId);
                socket.emit("roomJoined", {
                    roomId: room.roomId,
                    type: room.type,
                });
            }
            catch (error) {
                console.error("Join room error:", error);
                socket.emit("errorMessage", { error: "Unable to join room" });
            }
        }));
        // --------------------------------------------------------
        // 🟦 SEND MESSAGE
        // --------------------------------------------------------
        socket.on("sendMessage", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, message, replyTo }) {
            var _b, _c;
            try {
                // FIX: sending a message requires chat:send permission in addition to the
                //      chat:read check already enforced at connection time.
                const { userId: tokenUserId, role: tokenRole, companyId: tokenCompanyId } = socket.data.user;
                const rolesWithChatAccess = ["super_admin", "admin", "manager", "user"];
                if (!rolesWithChatAccess.includes(tokenRole)) {
                    const perms = yield (0, permissionCache_1.getUserPermissionsFromCache)(Number(tokenUserId), () => loadUserPermissionsFromDB(Number(tokenUserId)));
                    if (!perms.has("chat:send")) {
                        return socket.emit("errorMessage", {
                            error: "You do not have permission for chat",
                        });
                    }
                }
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId } });
                if (!room)
                    return socket.emit("errorMessage", { error: "Invalid roomId" });
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: room.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("errorMessage", {
                        error: "You are not a room member",
                    });
                }
                const newMessage = yield dbConnection_1.Message.create({
                    chatRoomId: room.id,
                    senderId: userId,
                    message,
                    replyTo: replyTo !== null && replyTo !== void 0 ? replyTo : null,
                });
                // Attach quoted message data so frontend can render WhatsApp-style reply preview
                let replyToMessage = null;
                if (replyTo) {
                    replyToMessage = yield dbConnection_1.Message.findByPk(replyTo, {
                        attributes: ["id", "message", "mediaUrl", "mediaType", "fileName", "senderId"],
                    });
                }
                // FIX: the raw Message row only carries `chatRoomId` (the numeric
                // DB FK), never the string `roomId` the frontend joined/tracks the
                // conversation by. formatMessage() on the client falls back to
                // "whatever room is currently open" whenever `roomId` is missing,
                // so a message for a chat the recipient doesn't have open right
                // now was silently misattributed (or dropped from the unread/
                // notification path) instead of showing up live. Attaching the
                // real roomId here removes the need for that fallback entirely.
                const sender = yield dbConnection_1.User.findByPk(userId, {
                    attributes: ["id", "firstName", "lastName", "email"],
                });
                const messagePayload = Object.assign(Object.assign({}, newMessage.toJSON()), { roomId, replyToMessage: replyToMessage ? replyToMessage.toJSON() : null, Sender: sender ? sender.toJSON() : { id: userId, firstName: "User" } });
                // Touch room updatedAt
                yield room.changed('updatedAt', true);
                yield room.save().catch(() => { });
                // 1. Emit to room
                io.to(roomId).emit("receiveMessage", messagePayload);
                // 2. Notify all participants in real-time
                const participants = yield dbConnection_1.ChatParticipant.findAll({
                    where: { chatRoomId: room.id },
                });
                // 3. Emit to all participants' user rooms (covers cases where socket hasn't joined roomId yet)
                for (const p of participants) {
                    io.to(`user_${p.userId}`).emit("receiveMessage", messagePayload);
                }
                const senderName = sender
                    ? `${(_b = sender.firstName) !== null && _b !== void 0 ? _b : ""} ${(_c = sender.lastName) !== null && _c !== void 0 ? _c : ""}`.trim()
                    : "Someone";
                // FIX: group notifications previously read "New message from X" with
                // no mention of which group — indistinguishable from a private
                // message. Lead with the group name and prefix the body with the
                // sender's name so a group notification is self-explanatory.
                const isGroupChat = room.type === "group";
                const notifTitle = isGroupChat ? (room.groupName || "Group") : `New message from ${senderName}`;
                const notifBody = isGroupChat
                    ? `${senderName}: ${message !== null && message !== void 0 ? message : "📎 Media message"}`
                    : (message !== null && message !== void 0 ? message : "📎 Media message");
                for (const participant of participants) {
                    if (participant.userId === userId)
                        continue; // skip sender
                    yield (0, notificationService_1.sendNotification)({
                        receiverId: participant.userId,
                        senderId: userId,
                        type: "chat",
                        title: notifTitle,
                        body: notifBody,
                        data: {
                            roomId,
                            messageId: String(newMessage.id),
                        },
                    });
                }
            }
            catch (error) {
                console.error("Send message error:", error);
                socket.emit("errorMessage", { error: "Failed to send message" });
            }
        }));
        // --------------------------------------------------------
        // 🟦 SEND FILE MESSAGE (image · video · audio · document · any file)
        // --------------------------------------------------------
        // Payload:
        //   roomId   : string
        //   fileData : base64 encoded file content
        //   fileName : original file name e.g. "photo.jpg"
        //   mimeType : e.g. "image/jpeg", "video/mp4", "application/pdf"
        //   caption? : optional text with the file
        //   replyTo? : optional message id being replied to
        socket.on("sendFileMessage", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, fileData, fileName, mimeType, caption, replyTo }) {
            var _b, _c, _d;
            try {
                if (!fileData || !fileName || !mimeType) {
                    return socket.emit("errorMessage", {
                        error: "fileData, fileName and mimeType are required",
                    });
                }
                const { userId: tokenUserId, role: tokenRole } = socket.data.user;
                const rolesWithChatAccess = ["super_admin", "admin", "manager", "user"];
                if (!rolesWithChatAccess.includes(tokenRole)) {
                    const perms = yield (0, permissionCache_1.getUserPermissionsFromCache)(Number(tokenUserId), () => loadUserPermissionsFromDB(Number(tokenUserId)));
                    if (!perms.has("chat:send")) {
                        return socket.emit("errorMessage", {
                            error: "You do not have permission for chat",
                        });
                    }
                }
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId } });
                if (!room)
                    return socket.emit("errorMessage", { error: "Invalid roomId" });
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: room.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("errorMessage", { error: "You are not a room member" });
                }
                // Upload file to S3 and get public URL
                const mediaUrl = yield uploadToS3(fileData, fileName, mimeType);
                // Derive mediaType from mimeType
                let mediaType = "file";
                if (mimeType.startsWith("image/"))
                    mediaType = "image";
                else if (mimeType.startsWith("video/"))
                    mediaType = "video";
                else if (mimeType.startsWith("audio/"))
                    mediaType = "audio";
                else if (mimeType === "application/pdf" ||
                    mimeType.includes("word") ||
                    mimeType.includes("excel") ||
                    mimeType.includes("spreadsheet") ||
                    mimeType.includes("presentation") ||
                    mimeType.includes("powerpoint") ||
                    mimeType === "text/plain") {
                    mediaType = "document";
                }
                const newMessage = yield dbConnection_1.Message.create({
                    chatRoomId: room.id,
                    senderId: userId,
                    message: caption !== null && caption !== void 0 ? caption : null,
                    mediaUrl,
                    mediaType,
                    fileName: fileName !== null && fileName !== void 0 ? fileName : null,
                    replyTo: replyTo !== null && replyTo !== void 0 ? replyTo : null,
                });
                // Attach quoted message data so frontend can render WhatsApp-style reply preview
                let replyToMessage = null;
                if (replyTo) {
                    replyToMessage = yield dbConnection_1.Message.findByPk(replyTo, {
                        attributes: ["id", "message", "mediaUrl", "mediaType", "fileName", "senderId"],
                    });
                }
                const sender = yield dbConnection_1.User.findByPk(userId, {
                    attributes: ["id", "firstName", "lastName", "email"],
                });
                const filePayload = Object.assign(Object.assign({}, newMessage.toJSON()), { roomId, replyToMessage: replyToMessage ? replyToMessage.toJSON() : null, Sender: sender ? sender.toJSON() : { id: userId, firstName: "User" } });
                // Touch room updatedAt
                yield room.changed('updatedAt', true);
                yield room.save().catch(() => { });
                io.to(roomId).emit("receiveFileMessage", filePayload);
                const participants = yield dbConnection_1.ChatParticipant.findAll({
                    where: { chatRoomId: room.id },
                });
                for (const p of participants) {
                    io.to(`user_${p.userId}`).emit("receiveFileMessage", filePayload);
                }
                const senderName = sender
                    ? `${(_b = sender.firstName) !== null && _b !== void 0 ? _b : ""} ${(_c = sender.lastName) !== null && _c !== void 0 ? _c : ""}`.trim()
                    : "Someone";
                const mediaLabel = mediaType === "image" ? "📷 Image" :
                    mediaType === "video" ? "🎥 Video" :
                        mediaType === "audio" ? "🎵 Audio" :
                            mediaType === "document" ? "📄 Document" :
                                "📎 File";
                // FIX: same group-identification fix as sendMessage — lead with the
                // group name and prefix the body with the sender's name.
                const isGroupChat = room.type === "group";
                const notifTitle = isGroupChat ? (room.groupName || "Group") : `New message from ${senderName}`;
                const notifBody = isGroupChat ? `${senderName}: ${mediaLabel}` : mediaLabel;
                for (const participant of participants) {
                    if (participant.userId === userId)
                        continue;
                    yield (0, notificationService_1.sendNotification)({
                        receiverId: participant.userId,
                        senderId: userId,
                        type: "chat",
                        title: notifTitle,
                        body: notifBody,
                        data: { roomId, messageId: String(newMessage.id) },
                    });
                }
            }
            catch (error) {
                console.error("Send file message error:", error);
                socket.emit("errorMessage", {
                    error: "Failed to send file message",
                    detail: (_d = error === null || error === void 0 ? void 0 : error.message) !== null && _d !== void 0 ? _d : String(error),
                });
            }
        }));
        // --------------------------------------------------------
        // 🟦 FORWARD MESSAGE  (copy a message into another room)
        // --------------------------------------------------------
        // Payload: { messageId, toRoomId }
        socket.on("forwardMessage", (_a) => __awaiter(void 0, [_a], void 0, function* ({ messageId, toRoomId }) {
            var _b, _c, _d, _e;
            try {
                const originalMsg = yield dbConnection_1.Message.findByPk(messageId);
                if (!originalMsg) {
                    return socket.emit("errorMessage", { error: "Original message not found" });
                }
                // FIX: previously only the target room's membership was checked —
                // the caller could forward any message by id (sequential integers,
                // easily enumerated) regardless of whether they belonged to the
                // room it originally came from, exfiltrating cross-tenant content.
                const isSourceParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: originalMsg.chatRoomId, userId },
                });
                if (!isSourceParticipant) {
                    return socket.emit("errorMessage", { error: "You are not a member of the source room" });
                }
                const targetRoom = yield dbConnection_1.ChatRoom.findOne({ where: { roomId: toRoomId } });
                if (!targetRoom) {
                    return socket.emit("errorMessage", { error: "Target room not found" });
                }
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: targetRoom.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("errorMessage", { error: "You are not a member of the target room" });
                }
                const forwarded = yield dbConnection_1.Message.create({
                    chatRoomId: targetRoom.id,
                    senderId: userId,
                    message: (_b = originalMsg.message) !== null && _b !== void 0 ? _b : null,
                    mediaUrl: (_c = originalMsg.mediaUrl) !== null && _c !== void 0 ? _c : null,
                    mediaType: (_d = originalMsg.mediaType) !== null && _d !== void 0 ? _d : null,
                    fileName: (_e = originalMsg.fileName) !== null && _e !== void 0 ? _e : null,
                    replyTo: null,
                });
                io.to(toRoomId).emit("receiveFileMessage", Object.assign(Object.assign({}, forwarded.toJSON()), { roomId: toRoomId, forwarded: true }));
                socket.emit("forwardMessage", { success: true, messageId: forwarded.id });
            }
            catch (error) {
                console.error("Forward message error:", error);
                socket.emit("errorMessage", { error: "Failed to forward message" });
            }
        }));
        // --------------------------------------------------------
        // 🟦 TYPING INDICATOR
        // --------------------------------------------------------
        socket.on("typing", (data) => {
            io.to(data.roomId).emit("typing", data);
        });
        // --------------------------------------------------------
        // 🟦 ONLINE / OFFLINE USER STATUS
        // --------------------------------------------------------
        socket.on("online", (data) => __awaiter(void 0, void 0, void 0, function* () {
            if (data.userId) {
                io.emit("onlineUser", { success: true, data: "online" });
            }
            else {
                io.emit("onlineUser", { success: true, data: "offline" });
            }
        }));
        // --------------------------------------------------------
        // 🟦 SEEN MESSAGE
        // --------------------------------------------------------
        socket.on("seenMessage", (msg) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const message = yield dbConnection_1.Message.findByPk(msg.msg_id);
                if (!message)
                    return;
                yield message.update({ status: "seen" });
                io.to(msg.roomId).emit("seenMessage", {
                    success: true,
                    msg_id: msg.msg_id,
                    seenBy: userId,
                    roomId: msg.roomId,
                    fileName: message.fileName,
                    mediaUrl: message.mediaUrl,
                    mediaType: message.mediaType,
                });
                if (message.senderId) {
                    io.to(`user_${message.senderId}`).emit("seenMessage", {
                        success: true,
                        msg_id: msg.msg_id,
                        seenBy: userId,
                        roomId: msg.roomId,
                    });
                }
            }
            catch (err) {
                console.error("Seen message error:", err);
            }
        }));
        // --------------------------------------------------------
        // 🟦 DELETE MESSAGE
        // --------------------------------------------------------
        socket.on("messageToDelete", (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                // FIX: senderId previously came from the client payload — any caller
                // could delete another user's message by supplying that user's id.
                // It must be the authenticated socket's own userId.
                const msg = yield dbConnection_1.Message.findOne({
                    where: { id: data.id, senderId: userId },
                });
                if (!msg)
                    return;
                const { fileName, mediaUrl, mediaType, chatRoomId } = msg;
                // FIX: deletion was broadcast via io.emit — every connected socket,
                // including users with no access to this room, received the just
                // deleted message's fileName/mediaUrl. Scope it to the room instead.
                const room = yield dbConnection_1.ChatRoom.findByPk(chatRoomId, { attributes: ["roomId"] });
                yield msg.destroy();
                if (room) {
                    io.to(room.roomId).emit("Deleted", {
                        id: data.id,
                        fileName,
                        mediaUrl,
                        mediaType,
                    });
                }
            }
            catch (error) {
                console.error("Error deleting message:", error);
            }
        }));
        // --------------------------------------------------------
        //  🟦 join user MESSAGE
        // -------------------------------------------------------
        socket.on("mychats", (msg) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const page = msg.page || 1;
                const limit = msg.limit || 10;
                const search = msg.search || "";
                const offset = (page - 1) * limit;
                let searchCondition = {};
                if (search !== "") {
                    searchCondition = {
                        [sequelize_1.Op.or]: [
                            { message: { [sequelize_1.Op.iLike]: `%${search}%` } }, // message text
                            { type: { [sequelize_1.Op.iLike]: `%${search}%` } }, // optional field
                            { senderName: { [sequelize_1.Op.iLike]: `%${search}%` } }, // optional
                        ],
                    };
                }
                const chatRoom = yield dbConnection_1.ChatRoom.findOne({
                    where: { roomId: msg.roomId },
                    attributes: ["id"],
                });
                // FIX: previously any authenticated socket could read any room's
                // full message history just by knowing its roomId — no check that
                // the caller is actually a participant of that room.
                if (chatRoom) {
                    const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                        where: { chatRoomId: chatRoom.id, userId },
                        attributes: ["id"],
                    });
                    if (!isParticipant) {
                        io.to(socket.id).emit("mychats", { success: false, error: "You are not a member of this room." });
                        return;
                    }
                }
                const result = yield dbConnection_1.Message.findAndCountAll({
                    where: Object.assign({ chatRoomId: chatRoom === null || chatRoom === void 0 ? void 0 : chatRoom.id }, searchCondition),
                    offset,
                    limit,
                    order: [["createdAt", "DESC"]],
                    include: [
                        {
                            model: dbConnection_1.Message,
                            as: "repliedMessage",
                            required: false,
                            attributes: ["id", "message", "mediaUrl", "mediaType", "fileName", "senderId"],
                        },
                    ],
                });
                const messages = result.rows.map((msg) => {
                    const plain = msg.get({ plain: true });
                    const { repliedMessage } = plain, rest = __rest(plain, ["repliedMessage"]);
                    return Object.assign(Object.assign({}, rest), { replyToMessage: repliedMessage !== null && repliedMessage !== void 0 ? repliedMessage : null });
                });
                io.to(socket.id).emit("mychats", {
                    success: true,
                    total: result.count,
                    totalPages: Math.ceil(result.count / limit),
                    currentPage: page,
                    data: messages,
                });
            }
            catch (error) {
                console.log("Error in mychats:", error);
            }
        }));
        socket.on("UserList", (_a) => __awaiter(void 0, [_a], void 0, function* ({ page = 1, limit = 10, search = "" }) {
            var _b;
            try {
                const offset = (page - 1) * limit;
                const cleanedSearch = typeof search === "string" ? search.trim() : "";
                // 🟢 sale_person gets a dedicated list: own admin + own manager + all cousins (other sale_persons)
                const childIds = userRole === "sale_person"
                    ? yield getSalePersonChatUserIds(userId)
                    : yield getAllRelatedUserIds(userId);
                // FIX: both helpers above walk the creator hierarchy with no notion
                // of company — an admin/manager assigned to more than one company
                // saw the OTHER company's staff in their chat contact list too.
                // Filter using the same company-membership resolution
                // getCompanyScopedChildUserIds uses elsewhere, failing open (keep)
                // for anyone whose company membership is indeterminate rather than
                // risk hiding a legitimate contact.
                const socketCompanyId = ((_b = socket.data.user) === null || _b === void 0 ? void 0 : _b.companyId) ? Number(socket.data.user.companyId) : null;
                let validUserIds = childIds;
                if (socketCompanyId != null && childIds.length > 0) {
                    const companyIdsByUser = yield (0, userHierarchy_1.collectUserCompanyIds)(childIds);
                    validUserIds = childIds.filter((id) => {
                        const companies = companyIdsByUser.get(id);
                        if (!companies || companies.size === 0)
                            return true;
                        return companies.has(socketCompanyId);
                    });
                }
                let userSearchCondition = {};
                if (cleanedSearch !== "") {
                    userSearchCondition = {
                        [sequelize_1.Op.or]: [
                            { firstName: { [sequelize_1.Op.iLike]: `%${cleanedSearch}%` } },
                            { lastName: { [sequelize_1.Op.iLike]: `%${cleanedSearch}%` } },
                            { email: { [sequelize_1.Op.iLike]: `%${cleanedSearch}%` } },
                        ],
                    };
                }
                const result = yield dbConnection_1.User.findAndCountAll({
                    where: Object.assign({ id: {
                            [sequelize_1.Op.in]: validUserIds,
                            [sequelize_1.Op.ne]: userId, // ❌ exclude logged-in user
                        } }, userSearchCondition),
                    attributes: [
                        "id",
                        "firstName",
                        "lastName",
                        "email",
                        "role",
                        "onlineSatus",
                    ],
                    order: [["id", "DESC"]],
                    limit,
                    offset,
                });
                // FIX: unreadCount was always 0 — the include that was meant to
                // populate it was commented out entirely, so private-chat sidebar
                // badges never showed. Compute unreadCount + lastMessage/lastMessageAt
                // per candidate from the deterministic private-room id
                // (`${min(a,b)}-${max(a,b)}`, the same convention buildRoomId in
                // UserChat.jsx and joinRoom already rely on). Also sort by last
                // activity so the sidebar reflects the most recently active
                // conversation first (WhatsApp-style) instead of raw id order.
                // NOTE: this sort only reorders within the current page — a fully
                // global "most recent across all pages" ordering would need the
                // query to originate from ChatRoom/Message rather than User.
                const usersWithUnreadCounts = yield Promise.all(result.rows.map((rowUser) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a;
                    const userObj = rowUser.get({ plain: true });
                    const otherId = userObj.id;
                    const pairRoomId = userId < otherId ? `${userId}-${otherId}` : `${otherId}-${userId}`;
                    const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId: pairRoomId }, attributes: ["id"] });
                    let unreadCount = 0;
                    let lastMessage = null;
                    let lastMessageAt = null;
                    if (room) {
                        const [count, latest] = yield Promise.all([
                            dbConnection_1.Message.count({
                                where: { chatRoomId: room.id, status: "unseen", senderId: { [sequelize_1.Op.ne]: userId } },
                            }),
                            dbConnection_1.Message.findOne({
                                where: { chatRoomId: room.id },
                                order: [["createdAt", "DESC"]],
                                attributes: ["message", "mediaType", "createdAt"],
                            }),
                        ]);
                        unreadCount = count;
                        if (latest) {
                            lastMessage = (_a = latest.message) !== null && _a !== void 0 ? _a : (latest.mediaType ? `📎 ${latest.mediaType}` : null);
                            lastMessageAt = latest.createdAt;
                        }
                    }
                    return Object.assign(Object.assign({}, userObj), { unreadCount, lastMessage, lastMessageAt });
                })));
                usersWithUnreadCounts.sort((a, b) => {
                    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                    return bt - at;
                });
                io.to(socket.id).emit("UserList", {
                    success: true,
                    total: result.count,
                    totalPages: Math.ceil(result.count / limit),
                    currentPage: page,
                    data: usersWithUnreadCounts,
                });
            }
            catch (error) {
                socket.emit("UserList", {
                    success: false,
                    error: "Unable to fetch user list",
                });
            }
        }));
        // --------------------------------------------------------
        // 🟦 CREATE GROUP
        // --------------------------------------------------------
        socket.on("createGroup", (_a) => __awaiter(void 0, [_a], void 0, function* ({ members = [], name = "New Group" }) {
            try {
                if (!members || members.length === 0) {
                    return socket.emit("createGroup", { error: "Group members are required" });
                }
                const requester = yield dbConnection_1.User.findByPk(userId, { attributes: ["tenantId"] });
                if (requester === null || requester === void 0 ? void 0 : requester.tenantId) {
                    const validMembers = yield dbConnection_1.User.findAll({
                        where: { id: { [sequelize_1.Op.in]: members }, tenantId: requester.tenantId },
                        attributes: ["id"],
                    });
                    if (validMembers.length !== members.length) {
                        return socket.emit("createGroup", { error: "Cannot add users from a different tenant." });
                    }
                }
                const newRoomId = (0, uuid_1.v4)();
                const room = yield dbConnection_1.ChatRoom.create({
                    roomId: newRoomId,
                    type: "group",
                    groupName: name,
                    createdBy: userId,
                });
                const dbRoomId = room.id;
                yield dbConnection_1.ChatParticipant.create({
                    chatRoomId: dbRoomId,
                    userId,
                });
                const bulk = members.map((m) => ({
                    chatRoomId: dbRoomId,
                    userId: m,
                }));
                yield dbConnection_1.ChatParticipant.bulkCreate(bulk, {
                    ignoreDuplicates: true,
                });
                socket.join(room.roomId);
                const allMembers = [userId, ...members];
                allMembers.forEach((mId) => {
                    io.to(`user_${mId}`).emit("groupCreated", {
                        roomId: room.roomId,
                        type: "group",
                        groupName: room.groupName,
                        createdBy: room.createdBy,
                        members: allMembers,
                    });
                    io.in(`user_${mId}`).socketsJoin(room.roomId);
                });
                socket.emit("createGroup", {
                    roomId: room.roomId,
                    type: "group",
                    groupName: room.groupName,
                    createdBy: room.createdBy,
                    members: allMembers,
                });
            }
            catch (error) {
                console.error("Create group error:", error);
                socket.emit("errorMessage", { error: "Unable to create group chat" });
            }
        }));
        // --------------------------------------------------------
        // ADD MEMBERS TO GROUP
        // --------------------------------------------------------
        socket.on("addGroupMembers", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, newMembers = [] }) {
            try {
                if (!newMembers || newMembers.length === 0) {
                    return socket.emit("addGroupMembers", { error: "No members provided to add." });
                }
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId, type: "group" } });
                if (!room) {
                    return socket.emit("addGroupMembers", { error: "Group room not found." });
                }
                // Verify if the requester is part of the group
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: room.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("addGroupMembers", { error: "You are not a member of this group." });
                }
                // Tenant isolation: only allow adding users from the same tenant
                const requester = yield dbConnection_1.User.findByPk(userId, { attributes: ["tenantId"] });
                if (requester === null || requester === void 0 ? void 0 : requester.tenantId) {
                    const validMembers = yield dbConnection_1.User.findAll({
                        where: { id: { [sequelize_1.Op.in]: newMembers }, tenantId: requester.tenantId },
                        attributes: ["id"],
                    });
                    if (validMembers.length !== newMembers.length) {
                        return socket.emit("addGroupMembers", { error: "Cannot add users from a different tenant." });
                    }
                }
                // Add the new members
                const bulk = newMembers.map((m) => ({
                    chatRoomId: room.id,
                    userId: m,
                }));
                yield dbConnection_1.ChatParticipant.bulkCreate(bulk, {
                    ignoreDuplicates: true,
                });
                io.to(roomId).emit("addGroupMembers", {
                    roomId,
                    newMembers,
                    addedBy: userId
                });
                newMembers.forEach((mId) => {
                    io.to(`user_${mId}`).emit("groupAdded", {
                        roomId,
                        groupName: room.groupName,
                        addedBy: userId,
                    });
                    io.in(`user_${mId}`).socketsJoin(room.roomId);
                });
            }
            catch (error) {
                socket.emit("addGroupMembers", { error: "Unable to add members to group." });
            }
        }));
        // --------------------------------------------------------
        // 🟦 REMOVE MEMBER FROM GROUP
        // --------------------------------------------------------
        socket.on("removeGroupMember", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, memberIdToRemove }) {
            try {
                if (!memberIdToRemove) {
                    return socket.emit("leaveGroup", { error: "Member ID to remove is required." });
                }
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId, type: "group" } });
                if (!room) {
                    return socket.emit("leaveGroup", { error: "Group room not found." });
                }
                // Verify if the requester is part of the group
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: room.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("leaveGroup", { error: "You are not a member of this group." });
                }
                // Remove the member
                const removed = yield dbConnection_1.ChatParticipant.destroy({
                    where: { chatRoomId: room.id, userId: memberIdToRemove }
                });
                if (removed) {
                    io.to(roomId).emit("leaveGroup", {
                        roomId,
                        removedMember: memberIdToRemove,
                        removedBy: userId
                    });
                }
                else {
                    socket.emit("leaveGroup", { error: "Member not found in group." });
                }
            }
            catch (error) {
                socket.emit("leaveGroup", { error: "Unable to remove member from group." });
            }
        }));
        // --------------------------------------------------------
        // 🟦 LEAVE GROUP
        // --------------------------------------------------------
        socket.on("leaveGroup", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId }) {
            try {
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId, type: "group" } });
                if (!room) {
                    return socket.emit("leaveGroup", { error: "Group room not found." });
                }
                // Remove the user from the participants table
                const removed = yield dbConnection_1.ChatParticipant.destroy({
                    where: { chatRoomId: room.id, userId }
                });
                if (removed) {
                    // Leave the socket io room
                    socket.leave(roomId);
                    // Notify others in the room
                    io.to(roomId).emit("memberLeft", {
                        roomId,
                        leftMember: userId
                    });
                    socket.emit("leaveGroup", { roomId });
                }
                else {
                    socket.emit("leaveGroup", { error: "You are not a member of this group." });
                }
            }
            catch (error) {
                socket.emit("leaveGroup", { error: "Unable to leave group." });
            }
        }));
        // --------------------------------------------------------
        // 🟦 GET GROUP DETAILS
        // --------------------------------------------------------
        socket.on("getGroupDetails", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId }) {
            try {
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId, type: "group" } });
                if (!room) {
                    return socket.emit("getGroupDetails", { error: "Group room not found." });
                }
                // Verify participant access
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: room.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("getGroupDetails", { error: "You are not a member of this group." });
                }
                // Fetch all participants with their User details
                const participants = yield dbConnection_1.ChatParticipant.findAll({
                    where: { chatRoomId: room.id },
                    include: [
                        {
                            model: dbConnection_1.User,
                            as: "user",
                            attributes: ["id", "firstName", "lastName", "email", "role", "onlineSatus"] // Adjust based on your User model
                        }
                    ]
                });
                socket.emit("getGroupDetails", {
                    roomId,
                    participants: participants.map((p) => p.user)
                });
            }
            catch (error) {
                socket.emit("getGroupDetails", { error: "Unable to get group details." });
            }
        }));
        // --------------------------------------------------------
        // 🟦 GET MY GROUPS
        // --------------------------------------------------------
        socket.on("getMyGroups", (...args_1) => __awaiter(void 0, [...args_1], void 0, function* ({ page = 1, limit = 10, search = "" } = {}) {
            try {
                const offset = (page - 1) * limit;
                // 1. Find all ChatRoom IDs that the user is a participant of
                const userParticipations = yield dbConnection_1.ChatParticipant.findAll({
                    where: { userId },
                    attributes: ['chatRoomId']
                });
                const chatRoomIds = userParticipations.map(p => p.chatRoomId);
                if (chatRoomIds.length === 0) {
                    return socket.emit("getMyGroups", {
                        success: true,
                        total: 0,
                        totalPages: 0,
                        currentPage: page,
                        data: [],
                    });
                }
                // 2. Fetch those ChatRoom details, filtering by type="group"
                const result = yield dbConnection_1.ChatRoom.findAndCountAll({
                    where: Object.assign({ id: { [sequelize_1.Op.in]: chatRoomIds }, type: "group" }, (search && { groupName: { [sequelize_1.Op.iLike]: `%${search}%` } })),
                    offset,
                    limit,
                    order: [["updatedAt", "DESC"]], // Show newest/most recently active groups first
                });
                // 3. Attach unread message counts + last-message preview for each group
                const groupsWithUnreadCounts = yield Promise.all(result.rows.map((group) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a, _b, _c;
                    const [unreadCount, latest] = yield Promise.all([
                        dbConnection_1.Message.count({
                            where: {
                                chatRoomId: group.id,
                                status: "unseen",
                                senderId: { [sequelize_1.Op.ne]: userId } // Don't count my own messages
                            }
                        }),
                        dbConnection_1.Message.findOne({
                            where: { chatRoomId: group.id },
                            order: [["createdAt", "DESC"]],
                            attributes: ["message", "mediaType", "createdAt", "senderId"],
                            include: [{ model: dbConnection_1.User, attributes: ["firstName", "lastName"] }],
                        }),
                    ]);
                    const lastMessageSenderName = (latest === null || latest === void 0 ? void 0 : latest.User)
                        ? `${(_a = latest.User.firstName) !== null && _a !== void 0 ? _a : ""} ${(_b = latest.User.lastName) !== null && _b !== void 0 ? _b : ""}`.trim()
                        : null;
                    // Convert Sequelize instance to POJO and inject unreadCount + last message
                    return Object.assign(Object.assign({}, group.get({ plain: true })), { unreadCount, lastMessage: latest ? ((_c = latest.message) !== null && _c !== void 0 ? _c : (latest.mediaType ? `📎 ${latest.mediaType}` : null)) : null, lastMessageAt: latest ? latest.createdAt : null, lastMessageSenderId: latest ? latest.senderId : null, lastMessageSenderName });
                })));
                // FIX: previously ordered purely by ChatRoom.updatedAt at the DB
                // query level — but creating a Message never touches its parent
                // ChatRoom row, so that column stays frozen at creation time and
                // groups never actually moved to the top on new activity. Re-sort
                // by real last-message time (falling back to updatedAt for groups
                // with no messages yet).
                groupsWithUnreadCounts.sort((a, b) => {
                    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.updatedAt).getTime();
                    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.updatedAt).getTime();
                    return bt - at;
                });
                socket.emit("getMyGroups", {
                    success: true,
                    total: result.count,
                    totalPages: Math.ceil(result.count / limit),
                    currentPage: page,
                    data: groupsWithUnreadCounts,
                });
            }
            catch (error) {
                console.error("Get my groups error:", error);
                socket.emit("getMyGroups", { error: "Unable to fetch group list." });
            }
        }));
        // --------------------------------------------------------
        // 🟦 UPDATE GROUP NAME
        // --------------------------------------------------------
        socket.on("updateGroupName", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, newName }) {
            try {
                if (!newName || newName.trim() === "") {
                    return socket.emit("updateGroupName", { error: "Group name cannot be empty." });
                }
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId, type: "group" } });
                if (!room) {
                    return socket.emit("updateGroupName", { error: "Group room not found." });
                }
                // Verify if the requester is part of the group
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: room.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("updateGroupName", { error: "You are not a member of this group." });
                }
                // Update the group name
                room.groupName = newName.trim();
                yield room.save();
                // Notify everyone in the group about the name change
                io.to(roomId).emit("updateGroupName", {
                    roomId,
                    newName: room.groupName,
                    updatedBy: userId
                });
            }
            catch (error) {
                console.error("Update group name error:", error);
                socket.emit("updateGroupName", { error: "Unable to update group name." });
            }
        }));
        // --------------------------------------------------------
        // 🟦 DELETE GROUP
        // --------------------------------------------------------
        socket.on("deleteGroup", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId }) {
            try {
                const room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId, type: "group" } });
                if (!room) {
                    return socket.emit("deleteGroup", { error: "Group room not found." });
                }
                // Verify if the requester is part of the group
                const isParticipant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: room.id, userId },
                });
                if (!isParticipant) {
                    return socket.emit("deleteGroup", { error: "You are not a member of this group." });
                }
                // FIX: previously any participant could delete the whole group for
                // everyone, not just its creator. Restrict to the creator — but only
                // for groups that actually have one on record: createdBy didn't
                // exist before this, so every group created before it shipped has
                // createdBy === null and keeps the original "any member" behavior
                // rather than becoming permanently undeletable by anyone.
                if (room.createdBy != null && Number(room.createdBy) !== userId) {
                    return socket.emit("deleteGroup", { error: "Only the group creator can delete this group." });
                }
                // Delete messages
                yield dbConnection_1.Message.destroy({ where: { chatRoomId: room.id } });
                // Delete all participants
                yield dbConnection_1.ChatParticipant.destroy({ where: { chatRoomId: room.id } });
                // Delete the room itself
                yield room.destroy();
                // Notify everyone in the group before dropping them
                io.to(roomId).emit("groupDeleted", {
                    roomId,
                    message: "Group has been deleted.",
                    deletedBy: userId
                });
                // Force all sockets to leave the room
                io.in(roomId).socketsLeave(roomId);
            }
            catch (error) {
                console.error("Delete group error:", error);
                socket.emit("deleteGroup", { error: "Unable to delete group." });
            }
        }));
        // --------------------------------------------------------
        socket.on("disconnect", (reason) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`SOCKET: Disconnected socketId: ${socket.id}, userId: ${userId} — reason: ${reason}`);
            const isFullyOffline = (0, notificationService_1.removeUserSocket)(userId, socket.id);
            if (isFullyOffline) {
                yield dbConnection_1.User.update({ onlineSatus: "offline" }, { where: { id: userId } });
                // 📡 Broadcast this user's offline status to ALL connected clients
                io.emit("userStatusChange", { userId, onlineSatus: "offline" });
            }
        }));
    }));
};
exports.initChatSocket = initChatSocket;
