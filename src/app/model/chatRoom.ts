// models/ChatRoom.ts
import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface ChatRoomAttributes {
  id: number;
  roomId: string;                  // ← REQUIRED
  type: "private" | "group";
}

interface ChatRoomCreation extends Optional<ChatRoomAttributes, "id"> {}

export class ChatRoom
  extends Model<ChatRoomAttributes, ChatRoomCreation>
  implements ChatRoomAttributes
{
  public id!: number;
  public roomId!: string;          // ← FIXED
  public type!: "private" | "group";

  static initModel(sequelize: Sequelize) {
    ChatRoom.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },

        roomId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },

        type: {
          type: DataTypes.ENUM("private", "group"),
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "chat_rooms",
        modelName: "ChatRoom",
      }
    );
  }
}
