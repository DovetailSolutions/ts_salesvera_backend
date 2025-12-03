import { Model, DataTypes, Sequelize } from "sequelize";

export class Message extends Model {
  public id!: number;
  public chatRoomId!: number;
  public senderId!: number;
  public message!: string | null;
  public mediaUrl!: string | null;
  public mediaType!: string | null;
  public replyTo!: number | null;
  public status!: "seen" |"unseen"
 

  static initModel(sequelize: Sequelize) {
    Message.init(
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
        senderId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        mediaUrl: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        mediaType: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        replyTo: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
         status: {
          type: DataTypes.ENUM("seen", "unseen"),
          defaultValue:"unseen",
        },
      },
      {
        sequelize,
        tableName: "messages",
        modelName: "Message",
      }
    );
  }
}
