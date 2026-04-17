import { Sequelize, DataTypes, Model, Optional } from "sequelize";

interface RepostAttributes {
  id: number;
  date: string;
  referenceNo: string;
  customerName: string;
  openingAmount: number;
  pendingAmount: number;
  status?: string;
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
  public status?: string;
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
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      date: {
        type: DataTypes.STRING, // you used "0000000001", so string is fine
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
        type: DataTypes.FLOAT,
        allowNull: false,
        field: "opening_amount",
      },
      pendingAmount: {
        type: DataTypes.FLOAT,
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
          type: DataTypes.ENUM("draft","imported", "sent", "accepted", "rejected"),
          defaultValue: "draft",
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
    },  
    {
      tableName: "repost",
      timestamps: true,
    }
  );

  return Repost;
};