import { Model, DataTypes, Sequelize } from "sequelize";

export class ChatParticipant extends Model {
  public id!: number;
  public chatRoomId!: number;
  public userId!: number;
  public role!: "member" | "admin";

  static initModel(sequelize: Sequelize) {
    ChatParticipant.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        chatRoomId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        role: {
          type: DataTypes.ENUM("member", "admin"),
          defaultValue: "member",
        },
      },
      {
        sequelize,
        tableName: "chat_participants",
        modelName: "ChatParticipant",
      }
    );
  }
}
