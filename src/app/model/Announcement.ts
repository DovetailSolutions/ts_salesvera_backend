import { Model, DataTypes, Sequelize, Optional } from "sequelize";

export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "cancelled" | "expired";
// Roles allowed to send announcements — sale_person is intentionally excluded
// (enforced again, independently, in announcement.service.ts).
export type AnnouncementCreatorRole = "user" | "admin" | "manager";

interface AnnouncementAttributes {
  id: number;
  title: string;
  message: string;
  createdBy: number;
  creatorRole: AnnouncementCreatorRole;
  companyId: number;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  scheduledAt?: Date | null;
  expiresAt?: Date | null;
}

interface AnnouncementCreationAttributes
  extends Optional<AnnouncementAttributes, "id" | "priority" | "status" | "scheduledAt" | "expiresAt"> {}

export class Announcement
  extends Model<AnnouncementAttributes, AnnouncementCreationAttributes>
  implements AnnouncementAttributes
{
  public id!: number;
  public title!: string;
  public message!: string;
  public createdBy!: number;
  public creatorRole!: AnnouncementCreatorRole;
  public companyId!: number;
  public priority!: AnnouncementPriority;
  public status!: AnnouncementStatus;
  public scheduledAt?: Date | null;
  public expiresAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize) {
    Announcement.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        createdBy: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        creatorRole: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        priority: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "normal",
        },
        status: {
          type: DataTypes.STRING(15),
          allowNull: false,
          defaultValue: "published",
        },
        scheduledAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "announcements",
        modelName: "Announcement",
        timestamps: true,
      }
    );
  }
}
