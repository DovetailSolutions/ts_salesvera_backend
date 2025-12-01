import { Model, DataTypes, Optional, Sequelize } from "sequelize";

interface AttendanceAttributes {
  id: number;
  employee_id: number;
  date: Date;
  punch_in?: Date | null;
  punch_out?: Date | null;
  working_hours?: number | null;
  status: "present" | "absent" | "leave" | "holiday" | "leaveReject";
  late?: boolean;
  overtime?: number | null;

  latitude_in?: string | null;
  longitude_in?: string | null;
  latitude_out?: string | null;
  longitude_out?: string | null;

  created_at?: Date;
  updated_at?: Date;
}

type AttendanceCreationAttributes = Optional<
  AttendanceAttributes,
  | "id"
  | "punch_in"
  | "punch_out"
  | "working_hours"
  | "late"
  | "overtime"
  | "latitude_in"
  | "longitude_in"
  | "latitude_out"
  | "longitude_out"
>;

export class Attendance
  extends Model<AttendanceAttributes, AttendanceCreationAttributes>
  implements AttendanceAttributes
{
  public id!: number;
  public employee_id!: number;
  public date!: Date;
  public punch_in!: Date | null;
  public punch_out!: Date | null;
  public working_hours!: number | null;
  public status!: "present" | "absent" | "leave" | "holiday" | "leaveReject";
  public late!: boolean;
  public overtime!: number | null;

  public latitude_in!: string | null;
  public longitude_in!: string | null;
  public latitude_out!: string | null;
  public longitude_out!: string | null;

  static initModel(sequelize: Sequelize): typeof Attendance {
    Attendance.init(
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
        date: {
          type: DataTypes.DATEONLY,
          allowNull: false,
        },
        punch_in: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        punch_out: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        working_hours: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM("present", "absent", "leave","leaveReject", "holiday"),
          allowNull: false,
          defaultValue: "present",
        },
        late: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        overtime: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
        latitude_in: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        longitude_in: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        latitude_out: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        longitude_out: {
          type: DataTypes.STRING,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "attendance",
        timestamps: true,
      }
    );

    return Attendance;
  }
}
