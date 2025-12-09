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

// export const initChatSocket = (io: Server) => {
//   io.use((socket, next) => {
//     const token = socket.handshake.headers.token as string;

//     if (!token) return next(new Error("Authentication error"));

//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET!);
//       socket.data.user = decoded;
//       next();
//     } catch (err) {
//       next(new Error("Authentication failed"));
//     }
//   });

//   io.on("connection", (socket) => {
//     console.log("Chat connected:", socket.id, "User:", socket.data.user.userId);
//     let userId = socket.data.user.userId;
//     let userRole = socket.data.user.role;

//     // Join room
//     socket.on(
//       "joinRoom",
//       async ({ roomId, type = "private", members = [] }) => {
//         try {
//           let room = await ChatRoom.findOne({ where: { roomId } });

//           // 🔥 If room does NOT exist → create new room
//           if (!room) {
//             const newRoomId = roomId || uuid();
//             room = await ChatRoom.create({
//               roomId: newRoomId,
//               type, // "private" or "group"
//             });

//             console.log("New room created:", newRoomId);
//           }

//           const dbRoomId = room.id;

//           console.log(">>>>>>>>>>????dbRoomId",dbRoomId)

//           // ✅ Add current user as participant if not exist
//           const participant = await ChatParticipant.findOne({
//             where: { chatRoomId: dbRoomId, userId },
//           });

//           if (!participant) {
//             await ChatParticipant.create({
//               chatRoomId: dbRoomId, // use integer primary key
//               userId,
//             });
//           }

//           // ✅ For group chat → add other members
//           if (type === "group" && members.length > 0) {
//             const bulk = members.map((m: any) => ({
//               chatRoomId: dbRoomId,
//               userId: m,
//             }));
//             await ChatParticipant.bulkCreate(bulk, { ignoreDuplicates: true });
//           }

//           // 🟦 Join socket.io room
//           socket.join(room.roomId);

//           console.log(`User ${userId} joined room ${room.roomId}`);

//           socket.emit("roomJoined", {
//             roomId: room.roomId,
//             type: room.type,
//           });
//         } catch (error) {
//           console.error("Join room error:", error);
//           socket.emit("errorMessage", {
//             error: "Unable to join room",
//           });
//         }
//       }
//     );

//     // Send message
//     socket.on("sendMessage", async ({ roomId, message }) => {
//      try{
//         const room = await ChatRoom.findOne({where:{roomId}})
//          if (!room) {
//           return socket.emit("errorMessage", { error: "Invalid roomId" });
//         }
//          const isParticipant = await ChatParticipant.findOne({
//           where: { chatRoomId: room.id, userId },
//         });
//         if (!isParticipant) {
//           return socket.emit("errorMessage", { error: "You are not a room member" });
//         }
//         const newMessage = await Message.create({
//           chatRoomId: room.id,
//           senderId: userId,
//           message: message,
//         })
//         io.to(roomId).emit("receiveMessage", newMessage);
//      }catch(error){
//         socket.emit("errorMessage", { error: "Failed to send message" });
//      }
//     });

//     socket.on('typing',(data)=>{
//         console.log(data);
//         io.to(data.roomId).emit("typing",data)
//     })

//     socket.on("online",async(data)=>{
//         const userId = data.userId;
//         if(userId){
//             io.emit('onlineUser',{success:true,data:"Online"})
//         }else{
//             io.emit('onlineUser',{success:true,data:"offline"})
//         }
//     })

//      socket.on('seen message', async msg => {
//                     await Message.update({
//                       _id: msg.msg_id
//                     },
//                       {
//                         seen: true
//                       })

//                     io.to(msg.roomId``).emit('seen message', msg)
//                   })

//       socket.on('messageToDelete', async (data) => {
//                     try {
//                         const deletedMessage = await Message.findByIdAndDelete(data.id);
//                         if (deletedMessage) {
//                             io.emit('Deleted', deletedMessage);
//                         } else {
//                             console.log('Message not found or already deleted');
//                         }
//                     } catch (error) {
//                         console.error('Error deleting message:', error);
//                     }
//                 });

//     socket.on("disconnect", () => {
//       console.log("Disconnected:", socket.id);
//     });
//   });
// };

type UserWithChildren = any & {
  createdUsers?: UserWithChildren[];
};

async function getAllChildUserIds(userId: number): Promise<number[]> {
  const result = new Set<number>();

  async function fetchLevel(id: number) {
    const user = (await User.findByPk(id, {
      include: [
        {
          model: User,
          as: "createdUsers",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    })) as UserWithChildren;

    if (!user?.createdUsers) return;

    for (const child of user.createdUsers) {
      if (!result.has(child.id)) {
        result.add(child.id);
        await fetchLevel(child.id); // recursive call
      }
    }
  }

  await fetchLevel(userId);

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

    // --------------------------------------------------------
    // 🟦 JOIN ROOM
    // --------------------------------------------------------
    socket.on(
      "joinRoom",
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
        await Message.update(
          { seen: true },
          { where: { id: msg.msg_id } } // Sequelize FIXED
        );

        io.to(msg.roomId).emit("seenMessage", msg);
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
          where: { id: data.id },
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

    // --------------------------------------------------------
    //  🟦 join user MESSAGE
    // --------------------------------------------------------

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
          { message: { [Op.iLike]: `%${search}%` } },  // message text
          { type: { [Op.iLike]: `%${search}%` } },     // optional field
          { senderName: { [Op.iLike]: `%${search}%` } } // optional
        ]
      };
    }
    const result = await Message.findAndCountAll({
      where: {
        chatRoomId: msg.roomId,
        ...searchCondition,   // <-- add search here
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

    const childIds = await getAllChildUserIds(userId);
    const validUserIds = [userId, ...childIds];

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

    const result = await ChatParticipant.findAndCountAll({
      where: {
        userId: { [Op.in]: validUserIds },
      },
      limit,
      offset,
      order: [["id", "DESC"]],

      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "email",
            "role",
            "onlineSatus",
          ],
          where: userSearchCondition,
          required: false,
        },
      ],
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
    socket.on("disconnect", () => {
      console.log("Disconnected:", socket.id);
    });
  });
};
