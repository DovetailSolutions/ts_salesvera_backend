import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface TaskHistoryAttributes {
  id: number;
  taskId: number;
  changedBy: number;
  field: string;
  oldValue?: string;
  newValue?: string;
}

interface TaskHistoryCreationAttributes
  extends Optional<TaskHistoryAttributes, "id" | "oldValue" | "newValue"> {}

export class TaskHistory
  extends Model<TaskHistoryAttributes, TaskHistoryCreationAttributes>
  implements TaskHistoryAttributes
{
  public id!: number;
  public taskId!: number;
  public changedBy!: number;
  public field!: string;
  public oldValue?: string;
  public newValue?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize) {
    TaskHistory.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        taskId: { type: DataTypes.INTEGER, allowNull: false },
        changedBy: { type: DataTypes.INTEGER, allowNull: false },
        field: { type: DataTypes.STRING(100), allowNull: false },
        oldValue: { type: DataTypes.TEXT, allowNull: true },
        newValue: { type: DataTypes.TEXT, allowNull: true },
      },
      {
        sequelize,
        tableName: "task_history",
        modelName: "TaskHistory",
        timestamps: true,
      }
    );
  }
}
