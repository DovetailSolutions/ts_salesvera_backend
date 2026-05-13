import { Model, DataTypes, Sequelize } from "sequelize";

export enum NotificationType {
  CHAT = "chat",
  TASK = "task",
  MEETING = "meeting",
  SYSTEM = "system",
  OTHER = "other"
}

export class Notification extends Model {
  public id!: number;
  public receiverId!: number;       // who receives this notification
  public senderId!: number | null;  // who triggered it (null = system)
  public type!: NotificationType;   // use enum
  public title!: string;
  public body!: string;
  public data!: Record<string, any> | null; // any extra JSON payload
  public isRead!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize) {
    Notification.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        receiverId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        senderId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: null,
        },
        type: {
          type: DataTypes.ENUM(...Object.values(NotificationType)),
          allowNull: false,
          defaultValue: NotificationType.SYSTEM,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        body: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: null,
        },
        isRead: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
      },
      {
        sequelize,
        tableName: "notifications",
        modelName: "Notification",
      }
    );
  }
}
