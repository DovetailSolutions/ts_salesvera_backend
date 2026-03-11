import { Op } from "sequelize";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import {
  ChatRoom,
  ChatParticipant,
  Message,
  User,
} from "../config/dbConnection";
import { v4 as uuid } from "uuid";

type UserWithRelations = any & {
  createdUsers?: UserWithRelations[];
};
// interface UserWithRelations extends User {
//   createdUsers?: User[];
//   creators?: User[];
// }

async function getAllRelatedUserIds(
  userId: number,
  includeSelf = false
): Promise<number[]> {
  const result = new Set<number>();
  if (includeSelf) result.add(userId);

  async function fetchRelations(
    id: number,
    direction: "children" | "parents"
  ): Promise<void> {
    const processedIds = new Set<number>();
    const queue: number[] = [id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (processedIds.has(currentId)) continue;
      processedIds.add(currentId);

      const user = (await User.findByPk(currentId, {
        include: [
          {
            model: User,
            as: direction === "children" ? "createdUsers" : "creators",
            through: { attributes: [] },
            attributes: ["id"],
          },
        ],
      })) as UserWithRelations;

      const relations =
        direction === "children" ? user.createdUsers : user.creators;

      if (!relations) continue;

      for (const relation of relations) {
        if (!result.has(relation.id)) {
          result.add(relation.id);
          queue.push(relation.id);
        }
      }
    }
  }

  // Fetch both children and parents concurrently
  await Promise.all([
    fetchRelations(userId, "children"),
    fetchRelations(userId, "parents"),
  ]);

  return Array.from(result);
}

export const initChatSocket = (io: Server) => {
  // ---------- 🔐 AUTH MIDDLEWARE ----------
  io.use((socket, next) => {
    const token = socket.handshake.headers.token as string;

    if (!token) return next(new Error("Authentication error"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log("Chat connected:", socket.id, "User:", socket.data.user.userId);

    const userId = socket.data.user.userId;
    const userRole = socket.data.user.role;


    console.log(">>>>>>>>>>>>>>userId",userId)
    console.log(">>>>>>>>>>>>>>userRole",userRole)
    



    // --------------------------------------------------------
    // 🟦 JOIN ROOM
    // --------------------------------------------------------
    socket.on("joinRoom",
      async ({ roomId, type = "private", members = [] }) => {
        try {
          let room = await ChatRoom.findOne({ where: { roomId } });

          // 🔥 Create room if not exists
          if (!room) {
            const newRoomId = roomId || uuid();

            room = await ChatRoom.create({
              roomId: newRoomId,
              type,
            });

            console.log("New room created:", newRoomId);
          }

          // Use DB primary key for relations (VERY IMPORTANT)
          const dbRoomId = room.id;

          // Add current user as participant
          const participant = await ChatParticipant.findOne({
            where: { chatRoomId: dbRoomId, userId },
          });

          if (!participant) {
            await ChatParticipant.create({
              chatRoomId: dbRoomId,
              userId,
            });
          }

          // Group chat → add members
          if (type === "group" && members.length > 0) {
            const bulk = members.map((m: any) => ({
              chatRoomId: dbRoomId,
              userId: m,
            }));

            await ChatParticipant.bulkCreate(bulk, {
              ignoreDuplicates: true,
            });
          }

          socket.join(room.roomId);

          socket.emit("roomJoined", {
            roomId: room.roomId,
            type: room.type,
          });

          console.log(`User ${userId} joined room ${room.roomId}`);
        } catch (error) {
          console.error("Join room error:", error);
          socket.emit("errorMessage", { error: "Unable to join room" });
        }
      }
    );

    // --------------------------------------------------------
    // 🟦 SEND MESSAGE
    // --------------------------------------------------------
    socket.on("sendMessage", async ({ roomId, message }) => {
      try {
        const room = await ChatRoom.findOne({ where: { roomId } });

        if (!room)
          return socket.emit("errorMessage", { error: "Invalid roomId" });

        const isParticipant = await ChatParticipant.findOne({
          where: { chatRoomId: room.id, userId },
        });

        if (!isParticipant) {
          return socket.emit("errorMessage", {
            error: "You are not a room member",
          });
        }

        const newMessage = await Message.create({
          chatRoomId: room.id,
          senderId: userId,
          message,
        });

        io.to(roomId).emit("receiveMessage", newMessage);
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("errorMessage", { error: "Failed to send message" });
      }
    });

    // --------------------------------------------------------
    // 🟦 TYPING INDICATOR
    // --------------------------------------------------------
    socket.on("typing", (data) => {
      io.to(data.roomId).emit("typing", data);
    });

    // --------------------------------------------------------
    // 🟦 ONLINE / OFFLINE USER STATUS
    // --------------------------------------------------------
    socket.on("online", async (data) => {
      if (data.userId) {
        io.emit("onlineUser", { success: true, data: "online" });
      } else {
        io.emit("onlineUser", { success: true, data: "offline" });
      }
    });

    // --------------------------------------------------------
    // 🟦 SEEN MESSAGE
    // --------------------------------------------------------
    socket.on("seenMessage", async (msg) => {
      try {
        const [updated] = await Message.update(
          { status: "seen" },
          { where: { id: msg.msg_id } }
        );

        if (!updated) {
          console.log("Message not found");
        }

        io.to(msg.roomId).emit("seenMessage", { 
          success: true, 
          data: updated,
          msg_id: msg.msg_id,
          seenBy: userId 
        });
      } catch (err) {
        console.error("Seen message error:", err);
      }
    });

    // --------------------------------------------------------
    // 🟦 DELETE MESSAGE
    // --------------------------------------------------------
    socket.on("messageToDelete", async (data) => {
      try {
        const deletedMessage = await Message.destroy({
          where: {
            id: data.id,
            senderId: data.senderId,
          },
        });

        if (deletedMessage) {
          io.emit("Deleted", { id: data.id });
        } else {
          console.log("Message not found or already deleted");
        }
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    });

    // --------------------------------------------------------
    //  🟦 join user MESSAGE
    // -------------------------------------------------------

    socket.on("mychats", async (msg) => {
      try {
        const page = msg.page || 1;
        const limit = msg.limit || 10;
        const search = msg.search || "";
        const offset = (page - 1) * limit;
        let searchCondition = {};
        if (search !== "") {
          searchCondition = {
            [Op.or]: [
              { message: { [Op.iLike]: `%${search}%` } }, // message text
              { type: { [Op.iLike]: `%${search}%` } }, // optional field
              { senderName: { [Op.iLike]: `%${search}%` } }, // optional
            ],
          };
        }
        const chatRoom = await ChatRoom.findOne({
          where: { roomId: msg.roomId },
          attributes: ["id"],
        });
        const result = await Message.findAndCountAll({
          where: {
            chatRoomId: chatRoom?.id,
            ...searchCondition, // <-- add search here
          },
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
      } catch (error) {
        console.log("Error in mychats:", error);
      }
    });




    socket.on("UserList", async ({ page = 1, limit = 10, search = "" }) => {
      try {
        const offset = (page - 1) * limit;
        const cleanedSearch = typeof search === "string" ? search.trim() : "";

        const childIds = await getAllRelatedUserIds(userId);
        console.log(">>>>>>>>>>>>>>>>childIds", childIds);
        const validUserIds = [userId, ...childIds];
        console.log(">>>>>>>>>>>>>>>>validUserIds", validUserIds);

        let userSearchCondition = {};

        if (cleanedSearch !== "") {
          userSearchCondition = {
            [Op.or]: [
              { firstName: { [Op.iLike]: `%${cleanedSearch}%` } },
              { lastName: { [Op.iLike]: `%${cleanedSearch}%` } },
              { email: { [Op.iLike]: `%${cleanedSearch}%` } },
            ],
          };
        }

        const result = await User.findAndCountAll({
          where: {
            id: {
              [Op.in]: validUserIds,
              [Op.ne]: userId, // ❌ exclude logged-in user
            },
            ...userSearchCondition, // Add search conditions
          },
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
              model: Message,
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

        io.to(socket.id).emit("UserList", {
          success: true,
          total: result.count,
          totalPages: Math.ceil(result.count / limit),
          currentPage: page,
          data: result.rows,
        });
      } catch (error) {
        console.error("UserList Error:", error);
        socket.emit("UserList", {
          success: false,
          error: "Unable to fetch user list",
        });
      }
    });


        // --------------------------------------------------------
    // 🟦 CREATE GROUP
    // --------------------------------------------------------
    socket.on("createGroup", async ({ members = [], name = "New Group" }) => {
      try {

        console.log(">>>>>>>>>>>>>>>members",members)
        if (!members || members.length === 0) {
          return socket.emit("createGroup", { error: "Group members are required" });
        }

        const newRoomId = uuid();

        // Create the group room
        const room = await ChatRoom.create({
          roomId: newRoomId,
          type: "group",
          groupName: name, // ← Save the group name
        });

        const dbRoomId = room.id;

        // Add the creator
        await ChatParticipant.create({
          chatRoomId: dbRoomId,
          userId,
        });

        // Add the other members
        const bulk = members.map((m: any) => ({
          chatRoomId: dbRoomId,
          userId: m,
        }));

        await ChatParticipant.bulkCreate(bulk, {
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
      } catch (error) {
        console.error("Create group error:", error);
        socket.emit("errorMessage", { error: "Unable to create group chat" });
      }
    });

    // --------------------------------------------------------
    // 🟦 ADD MEMBERS TO GROUP
    // --------------------------------------------------------
    socket.on("addGroupMembers", async ({ roomId, newMembers = [] }) => {
      try {
        if (!newMembers || newMembers.length === 0) {
          return socket.emit("addGroupMembers", { error: "No members provided to add." });
        }

        const room = await ChatRoom.findOne({ where: { roomId, type: "group" } });
        if (!room) {
          return socket.emit("addGroupMembers", { error: "Group room not found." });
        }

        // Verify if the requester is part of the group
        const isParticipant = await ChatParticipant.findOne({
          where: { chatRoomId: room.id, userId },
        });

        if (!isParticipant) {
          return socket.emit("addGroupMembers", { error: "You are not a member of this group." });
        }

        // Add the new members
        const bulk = newMembers.map((m: any) => ({
          chatRoomId: room.id,
          userId: m,
        }));

        await ChatParticipant.bulkCreate(bulk, {
          ignoreDuplicates: true,
        });

        io.to(roomId).emit("addGroupMembers", {
          roomId,
          addedMembers: newMembers,
          addedBy: userId
        });

        // console.log(`User ${userId} added members ${newMembers} to group ${roomId}`);
      } catch (error) {
        // console.error("Add members error:", error);
        socket.emit("addGroupMembers", { error: "Unable to add members to group." });
      }
    });

    // --------------------------------------------------------
    // 🟦 REMOVE MEMBER FROM GROUP
    // --------------------------------------------------------
    socket.on("removeGroupMember", async ({ roomId, memberIdToRemove }) => {
      try {
        if (!memberIdToRemove) {
          return socket.emit("leaveGroup", { error: "Member ID to remove is required." });
        }

        const room = await ChatRoom.findOne({ where: { roomId, type: "group" } });
        if (!room) {
          return socket.emit("leaveGroup", { error: "Group room not found." });
        }

        // Verify if the requester is part of the group
        const isParticipant = await ChatParticipant.findOne({
          where: { chatRoomId: room.id, userId },
        });

        if (!isParticipant) {
          return socket.emit("leaveGroup", { error: "You are not a member of this group." });
        }

        // Remove the member
        const removed = await ChatParticipant.destroy({
          where: { chatRoomId: room.id, userId: memberIdToRemove }
        });

        if (removed) {
          io.to(roomId).emit("leaveGroup", {
            roomId,
            removedMember: memberIdToRemove,
            removedBy: userId
          });
          // console.log(`User ${userId} removed member ${memberIdToRemove} from group ${roomId}`);
        } else {
           socket.emit("leaveGroup", { error: "Member not found in group." });
        }
      } catch (error) {
        // console.error("Remove member error:", error);
        socket.emit("leaveGroup", { error: "Unable to remove member from group." });
      }
    });

    // --------------------------------------------------------
    // 🟦 LEAVE GROUP
    // --------------------------------------------------------
    socket.on("leaveGroup", async ({ roomId }) => {
      try {
        const room = await ChatRoom.findOne({ where: { roomId, type: "group" } });
        if (!room) {
          return socket.emit("leaveGroup", { error: "Group room not found." });
        }

        // Remove the user from the participants table
        const removed = await ChatParticipant.destroy({
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
        } else {
           socket.emit("leaveGroup", { error: "You are not a member of this group." });
        }
      } catch (error) {
        socket.emit("leaveGroup", { error: "Unable to leave group." });
      }
    });

    // --------------------------------------------------------
    // 🟦 GET GROUP DETAILS
    // --------------------------------------------------------
    socket.on("getGroupDetails", async ({ roomId }) => {
      try {
        const room = await ChatRoom.findOne({ where: { roomId, type: "group" } });
        if (!room) {
          return socket.emit("getGroupDetails", { error: "Group room not found." });
        }

        // Verify participant access
        const isParticipant = await ChatParticipant.findOne({
          where: { chatRoomId: room.id, userId },
        });

        if (!isParticipant) {
          return socket.emit("getGroupDetails", { error: "You are not a member of this group." });
        }

        // Fetch all participants with their User details
        const participants = await ChatParticipant.findAll({
          where: { chatRoomId: room.id },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email", "role", "onlineSatus"] // Adjust based on your User model
            }
          ]
        });

        socket.emit("getGroupDetails", {
          roomId,
          participants: participants.map((p: any) => p.user)
        });

      } catch (error) {
        socket.emit("getGroupDetails", { error: "Unable to get group details." });
      }
    });

    // --------------------------------------------------------
    // 🟦 GET MY GROUPS
    // --------------------------------------------------------
    socket.on("getMyGroups", async ({ page = 1, limit = 10, search = "" } : any = {}) => {
      try {
        const offset = (page - 1) * limit;
        
        // 1. Find all ChatRoom IDs that the user is a participant of
        const userParticipations = await ChatParticipant.findAll({
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
        const result = await ChatRoom.findAndCountAll({
          where: {
             id: { [Op.in]: chatRoomIds },
             type: "group",
             ...(search && { groupName: { [Op.iLike]: `%${search}%` } }), // ← Search by group name
          },
          offset,
          limit,
          order: [["updatedAt", "DESC"]], // Show newest/most recently active groups first
        });
        socket.emit("getMyGroups", {
          success: true,
          total: result.count,
          totalPages: Math.ceil(result.count / limit),
          currentPage: page,
          data: result.rows,
        });

      } catch (error) {
        console.error("Get my groups error:", error);
        socket.emit("getMyGroups", { error: "Unable to fetch group list." });
      }
    });

    // --------------------------------------------------------
    // 🟦 UPDATE GROUP NAME
    // --------------------------------------------------------
    socket.on("updateGroupName", async ({ roomId, newName }) => {
      try {
        if (!newName || newName.trim() === "") {
          return socket.emit("updateGroupName", { error: "Group name cannot be empty." });
        }

        const room = await ChatRoom.findOne({ where: { roomId, type: "group" } });
        if (!room) {
          return socket.emit("updateGroupName", { error: "Group room not found." });
        }

        // Verify if the requester is part of the group
        const isParticipant = await ChatParticipant.findOne({
          where: { chatRoomId: room.id, userId },
        });

        if (!isParticipant) {
          return socket.emit("updateGroupName", { error: "You are not a member of this group." });
        }

        // Update the group name
        room.groupName = newName.trim();
        await room.save();

        // Notify everyone in the group about the name change
        io.to(roomId).emit("updateGroupName", {
          roomId,
          newName: room.groupName,
          updatedBy: userId
        });

        console.log(`User ${userId} updated group ${roomId} name to "${room.groupName}"`);
      } catch (error) {
        console.error("Update group name error:", error);
        socket.emit("updateGroupName", { error: "Unable to update group name." });
      }
    });

    // --------------------------------------------------------
    // 🟦 DELETE GROUP
    // --------------------------------------------------------
    socket.on("deleteGroup", async ({ roomId }) => {
      try {
        const room = await ChatRoom.findOne({ where: { roomId, type: "group" } });
        if (!room) {
          return socket.emit("deleteGroup", { error: "Group room not found." });
        }

        // Verify if the requester is part of the group
        const isParticipant = await ChatParticipant.findOne({
          where: { chatRoomId: room.id, userId },
        });

        if (!isParticipant) {
          return socket.emit("deleteGroup", { error: "You are not a member of this group." });
        }

        // Delete messages
        await Message.destroy({ where: { chatRoomId: room.id } });

        // Delete all participants
        await ChatParticipant.destroy({ where: { chatRoomId: room.id } });

        // Delete the room itself
        await room.destroy();

        // Notify everyone in the group before dropping them
        io.to(roomId).emit("groupDeleted", {
          roomId,
          message: "Group has been deleted.",
          deletedBy: userId
        });

        // Force all sockets to leave the room
        io.in(roomId).socketsLeave(roomId);

        console.log(`User ${userId} deleted group ${roomId}`);
      } catch (error) {
        console.error("Delete group error:", error);
        socket.emit("deleteGroup", { error: "Unable to delete group." });
      }
    });

    // --------------------------------------------------------
    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
    });
  });
};
