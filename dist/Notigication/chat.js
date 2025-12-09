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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChatSocket = void 0;
const sequelize_1 = require("sequelize");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbConnection_1 = require("../config/dbConnection");
const uuid_1 = require("uuid");
// interface UserWithRelations extends User {
//   createdUsers?: User[];
//   creators?: User[];
// }
function getAllRelatedUserIds(userId_1) {
    return __awaiter(this, arguments, void 0, function* (userId, includeSelf = false) {
        const result = new Set();
        if (includeSelf)
            result.add(userId);
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
        // Fetch both children and parents concurrently
        yield Promise.all([
            fetchRelations(userId, "children"),
            fetchRelations(userId, "parents"),
        ]);
        return Array.from(result);
    });
}
const initChatSocket = (io) => {
    // ---------- 🔐 AUTH MIDDLEWARE ----------
    io.use((socket, next) => {
        const token = socket.handshake.headers.token;
        if (!token)
            return next(new Error("Authentication error"));
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.user = decoded;
            next();
        }
        catch (err) {
            next(new Error("Authentication failed"));
        }
    });
    io.on("connection", (socket) => {
        console.log("Chat connected:", socket.id, "User:", socket.data.user.userId);
        const userId = socket.data.user.userId;
        const userRole = socket.data.user.role;
        // --------------------------------------------------------
        // 🟦 JOIN ROOM
        // --------------------------------------------------------
        socket.on("joinRoom", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, type = "private", members = [] }) {
            try {
                let room = yield dbConnection_1.ChatRoom.findOne({ where: { roomId } });
                // 🔥 Create room if not exists
                if (!room) {
                    const newRoomId = roomId || (0, uuid_1.v4)();
                    room = yield dbConnection_1.ChatRoom.create({
                        roomId: newRoomId,
                        type,
                    });
                    console.log("New room created:", newRoomId);
                }
                // Use DB primary key for relations (VERY IMPORTANT)
                const dbRoomId = room.id;
                // Add current user as participant
                const participant = yield dbConnection_1.ChatParticipant.findOne({
                    where: { chatRoomId: dbRoomId, userId },
                });
                if (!participant) {
                    yield dbConnection_1.ChatParticipant.create({
                        chatRoomId: dbRoomId,
                        userId,
                    });
                }
                // Group chat → add members
                if (type === "group" && members.length > 0) {
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
                console.log(`User ${userId} joined room ${room.roomId}`);
            }
            catch (error) {
                console.error("Join room error:", error);
                socket.emit("errorMessage", { error: "Unable to join room" });
            }
        }));
        // --------------------------------------------------------
        // 🟦 SEND MESSAGE
        // --------------------------------------------------------
        socket.on("sendMessage", (_a) => __awaiter(void 0, [_a], void 0, function* ({ roomId, message }) {
            try {
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
                });
                io.to(roomId).emit("receiveMessage", newMessage);
            }
            catch (error) {
                console.error("Send message error:", error);
                socket.emit("errorMessage", { error: "Failed to send message" });
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
                yield dbConnection_1.Message.update({ seen: true }, { where: { id: msg.msg_id } } // Sequelize FIXED
                );
                io.to(msg.roomId).emit("seenMessage", msg);
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
                const deletedMessage = yield dbConnection_1.Message.destroy({
                    where: { id: data.id },
                });
                if (deletedMessage) {
                    io.emit("Deleted", { id: data.id });
                }
                else {
                    console.log("Message not found or already deleted");
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
                const result = yield dbConnection_1.Message.findAndCountAll({
                    where: Object.assign({ chatRoomId: chatRoom === null || chatRoom === void 0 ? void 0 : chatRoom.id }, searchCondition),
                    offset,
                    limit,
                    raw: true,
                    nest: true,
                    order: [["createdAt", "DESC"]],
                });
                io.to(socket.id).emit("mychats", {
                    success: true,
                    total: result.count,
                    totalPages: Math.ceil(result.count / limit),
                    currentPage: page,
                    data: result.rows,
                });
            }
            catch (error) {
                console.log("Error in mychats:", error);
            }
        }));
        socket.on("UserList", (_a) => __awaiter(void 0, [_a], void 0, function* ({ page = 1, limit = 10, search = "" }) {
            try {
                const offset = (page - 1) * limit;
                const cleanedSearch = typeof search === "string" ? search.trim() : "";
                const childIds = yield getAllRelatedUserIds(userId);
                console.log(">>>>>>>>>>>>>>>>childIds", childIds);
                const validUserIds = [userId, ...childIds];
                console.log(">>>>>>>>>>>>>>>>validUserIds", validUserIds);
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
                io.to(socket.id).emit("UserList", {
                    success: true,
                    total: result.count,
                    totalPages: Math.ceil(result.count / limit),
                    currentPage: page,
                    data: result.rows,
                });
            }
            catch (error) {
                console.error("UserList Error:", error);
                socket.emit("UserList", {
                    success: false,
                    error: "Unable to fetch user list",
                });
            }
        }));
        // --------------------------------------------------------
        socket.on("disconnect", () => {
            console.log("Disconnected:", socket.id);
        });
    });
};
exports.initChatSocket = initChatSocket;
