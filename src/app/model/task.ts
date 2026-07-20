import { Model, DataTypes, Sequelize, Optional } from "sequelize";

export type TaskStatus   = "todo" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

interface TaskAttributes {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  assignedTo?: number;
  assignedBy: number;
  companyId: number;
  tags?: string[]; // Optional field for tags
  completedAt?: Date | null;
}

interface TaskCreationAttributes
  extends Optional<TaskAttributes, "id" | "status" | "priority"> {}

export class Task
  extends Model<TaskAttributes, TaskCreationAttributes>
  implements TaskAttributes
{
  public id!: number;
  public title!: string;
  public description?: string;
  public status!: TaskStatus;
  public priority!: TaskPriority;
  public dueDate?: Date;
  public assignedTo?: number;
  public assignedBy!: number;
  public companyId!: number;
  public tags?: string[]; // Optional field for tags
  public completedAt?: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize) {
    Task.init(
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
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM("todo", "in_progress", "completed", "cancelled"),
          allowNull: false,
          defaultValue: "todo",
        },
        priority: {
          type: DataTypes.ENUM("low", "medium", "high", "urgent"),
          allowNull: false,
          defaultValue: "medium",
        },
        dueDate: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        assignedTo: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        assignedBy: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        tags:{
          type: DataTypes.ARRAY(DataTypes.STRING),
          allowNull: true,
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "tasks",
        modelName: "Task",
        timestamps: true,
      }
    );
  }
}
