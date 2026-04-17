import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface RepostAttributes {
  id: number;
  date: string;
  referenceNo: string;
  customerName: string;
  openingAmount: number;
  pendingAmount: number;
  status?: "draft" | "imported" | "sent" | "accepted" | "rejected";
  dueOn: Date;
  overdueDays: number;
  userId: number;
  companyId: number;
}

interface RepostCreationAttributes
  extends Optional<RepostAttributes, "id" | "status"> {}

export class Repost
  extends Model<RepostAttributes, RepostCreationAttributes>
  implements RepostAttributes {
  public id!: number;
  public date!: string;
  public referenceNo!: string;
  public customerName!: string;
  public openingAmount!: number;
  public pendingAmount!: number;
  public status!: "draft" | "imported" | "sent" | "accepted" | "rejected";
  public dueOn!: Date;
  public overdueDays!: number;
  public userId!: number;
  public companyId!: number;
}

export const RepostModel = (sequelize: Sequelize) => {
  const Repost = sequelize.define<Repost>(
    "Repost",
    {
      id: {
        type: DataTypes.INTEGER, // ✅ fixed (no UNSIGNED)
        autoIncrement: true,
        primaryKey: true,
      },

      date: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      referenceNo: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "reference_no",
      },

      customerName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "customer_name",
      },

      openingAmount: {
        type: DataTypes.DECIMAL(10, 2), // ✅ fixed
        allowNull: false,
        field: "opening_amount",
      },

      pendingAmount: {
        type: DataTypes.DECIMAL(10, 2), // ✅ fixed
        allowNull: false,
        field: "pending_amount",
      },

      dueOn: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "due_on",
      },

      overdueDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "overdue_days",
      },

      status: {
        type: DataTypes.ENUM(
          "draft",
          "imported",
          "sent",
          "accepted",
          "rejected"
        ),
        allowNull: false, // ✅ added
        defaultValue: "draft",
      },

      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      companyId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "repost",
      freezeTableName: true, // ✅ IMPORTANT
      timestamps: true,
    }
  );

  return Repost;
};