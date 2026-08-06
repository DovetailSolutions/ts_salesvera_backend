// models/ChatRoom.ts
import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface ChatRoomAttributes {
  id: number;
  roomId: string;                  // ← REQUIRED
  type: "private" | "group";
  groupName?: string;              // ← OPTIONAL GROUP NAME
  createdBy?: number | null;       // ← group creator, null for private rooms and pre-existing groups
}

interface ChatRoomCreation extends Optional<ChatRoomAttributes, "id"> {}

export class ChatRoom
  extends Model<ChatRoomAttributes, ChatRoomCreation>
  implements ChatRoomAttributes
{
  public id!: number;
  public roomId!: string;          // ← FIXED
  public type!: "private" | "group";
  public groupName?: string;       // ← ADDED
  public createdBy?: number | null;

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
        groupName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: true,
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
