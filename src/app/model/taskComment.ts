import { Model, DataTypes, Sequelize, Optional } from "sequelize";

interface TaskCommentAttributes {
  id: number;
  taskId: number;
  userId: number;
  body: string;
}

interface TaskCommentCreationAttributes
  extends Optional<TaskCommentAttributes, "id"> {}

export class TaskComment
  extends Model<TaskCommentAttributes, TaskCommentCreationAttributes>
  implements TaskCommentAttributes
{
  public id!: number;
  public taskId!: number;
  public userId!: number;
  public body!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize) {
    TaskComment.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        taskId: { type: DataTypes.INTEGER, allowNull: false },
        userId: { type: DataTypes.INTEGER, allowNull: false },
        body: { type: DataTypes.TEXT, allowNull: false },
      },
      {
        sequelize,
        tableName: "task_comments",
        modelName: "TaskComment",
        timestamps: true,
      }
    );
  }
}
