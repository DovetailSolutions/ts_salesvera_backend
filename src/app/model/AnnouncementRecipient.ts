import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface AnnouncementRecipientAttributes {
  id: number;
  announcementId: number;
  recipientId: number;
  recipientRole: string;
  companyId: number;
  isRead: boolean;
  readAt?: Date | null;
  deliveredAt?: Date | null;
}

interface AnnouncementRecipientCreationAttributes
  extends Optional<AnnouncementRecipientAttributes, "id" | "isRead" | "readAt" | "deliveredAt"> {}

export class AnnouncementRecipient
  extends Model<AnnouncementRecipientAttributes, AnnouncementRecipientCreationAttributes>
  implements AnnouncementRecipientAttributes
{
  public id!: number;
  public announcementId!: number;
  public recipientId!: number;
  public recipientRole!: string;
  public companyId!: number;
  public isRead!: boolean;
  public readAt?: Date | null;
  public deliveredAt?: Date | null;
  public readonly createdAt!: Date;

  static initModel(sequelize: Sequelize) {
    AnnouncementRecipient.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        announcementId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        recipientId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        recipientRole: {
          type: DataTypes.STRING(20),
          allowNull: false,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        isRead: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        readAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        deliveredAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "announcement_recipients",
        modelName: "AnnouncementRecipient",
        timestamps: true,
        updatedAt: false,
      }
    );
  }
}
