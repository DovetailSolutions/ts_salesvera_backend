import { Model, DataTypes, Optional, Sequelize } from "sequelize";

interface LeaveAttributes {
  id: number;
  employee_id: number;
  from_date: Date;
  to_date: Date;
  reason?: string | null;
  status: "pending" | "approved" | "rejected";
}

type LeaveCreationAttributes = Optional<
  LeaveAttributes,
  "id" | "reason" | "status" 
>;

export class Leave
  extends Model<LeaveAttributes, LeaveCreationAttributes>
  implements LeaveAttributes
{
  public id!: number;
  public employee_id!: number;
  public from_date!: Date;
  public to_date!: Date;
  public reason!: string | null;
  public status!: "pending" | "approved" | "rejected";

  static initModel(sequelize: Sequelize): typeof Leave {
    Leave.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        employee_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        from_date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
        to_date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM("pending", "approved", "rejected"),
          allowNull: false,
          defaultValue: "pending",
        },
      },
      {
        sequelize,
        tableName: "leave_requests",
        timestamps: true,
      }
    );

    return Leave;
  }
}
