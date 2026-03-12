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
        console.log(">>>>>>>>>>>>>>userId", userId);
        console.log(">>>>>>>>>>>>>>userRole", userRole);
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
                const [updated] = yield dbConnection_1.Message.update({ status: "seen" }, { where: { id: msg.msg_id } });
                if (!updated) {
                    console.log("Message not found");
                }
                io.to(msg.roomId).emit("seenMessage", {
                    success: true,
                    data: updated,
                    msg_id: msg.msg_id,
                    seenBy: userId
                });
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
                    where: {
                        id: data.id,
                        senderId: data.senderId,
                    },
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
                    include: [
                        {
                            model: dbConnection_1.Message,
                            as: "Messages",
                            where: {
                                status: "unseen",
                            },
                            required: false,
                            separate: true, // 🔥 important: does not break pagination
                            attributes: ["id", "status"],
                        },
                    ],
                    order: [["id", "DESC"]],
                    limit,
                    offset,
                });
                // Attach a flat unreadCount mathematically
                const usersWithUnreadCounts = result.rows.map((user) => {
                    const userObj = user.get({ plain: true });
                    // The included Messages array contains only "unseen" messages from this user
                    const unreadCount = userObj.Messages ? userObj.Messages.length : 0;
                    return Object.assign(Object.assign({}, userObj), { unreadCount });
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
                console.error("UserList Error:", error);
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
                console.log(">>>>>>>>>>>>>>>members", members);
                if (!members || members.length === 0) {
                    return socket.emit("createGroup", { error: "Group members are required" });
                }
                const newRoomId = (0, uuid_1.v4)();
                // Create the group room
                const room = yield dbConnection_1.ChatRoom.create({
                    roomId: newRoomId,
                    type: "group",
                    groupName: name, // ← Save the group name
                });
                const dbRoomId = room.id;
                // Add the creator
                yield dbConnection_1.ChatParticipant.create({
                    chatRoomId: dbRoomId,
                    userId,
                });
                // Add the other members
                const bulk = members.map((m) => ({
                    chatRoomId: dbRoomId,
                    userId: m,
                }));
                yield dbConnection_1.ChatParticipant.bulkCreate(bulk, {
                    ignoreDuplicates: true,
                });
                // Join socket.io room
                socket.join(room.roomId);
                socket.emit("createGroup", {
                    roomId: room.roomId,
                    type: "group",
                    groupName: room.groupName,
                    members: [userId, ...members],
                });
                console.log(`User ${userId} created group ${room.roomId}`);
            }
            catch (error) {
                console.error("Create group error:", error);
                socket.emit("errorMessage", { error: "Unable to create group chat" });
            }
        }));
        // --------------------------------------------------------
        // 🟦 ADD MEMBERS TO GROUP
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
                    addedMembers: newMembers,
                    addedBy: userId
                });
                // console.log(`User ${userId} added members ${newMembers} to group ${roomId}`);
            }
            catch (error) {
                // console.error("Add members error:", error);
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
                    // console.log(`User ${userId} removed member ${memberIdToRemove} from group ${roomId}`);
                }
                else {
                    socket.emit("leaveGroup", { error: "Member not found in group." });
                }
            }
            catch (error) {
                // console.error("Remove member error:", error);
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
                    // console.log(`User ${userId} left group ${roomId}`);
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
                // 3. Attach unread message counts for each group
                const groupsWithUnreadCounts = yield Promise.all(result.rows.map((group) => __awaiter(void 0, void 0, void 0, function* () {
                    const unreadCount = yield dbConnection_1.Message.count({
                        where: {
                            chatRoomId: group.id,
                            status: "unseen",
                            senderId: { [sequelize_1.Op.ne]: userId } // Don't count my own messages
                        }
                    });
                    // Convert Sequelize instance to POJO and inject unreadCount
                    return Object.assign(Object.assign({}, group.get({ plain: true })), { unreadCount });
                })));
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
                console.log(`User ${userId} updated group ${roomId} name to "${room.groupName}"`);
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
                console.log(`User ${userId} deleted group ${roomId}`);
            }
            catch (error) {
                console.error("Delete group error:", error);
                socket.emit("deleteGroup", { error: "Unable to delete group." });
            }
        }));
        // --------------------------------------------------------
        socket.on("disconnect", () => {
            console.log("Disconnected:", socket.id);
        });
    });
};
exports.initChatSocket = initChatSocket;
