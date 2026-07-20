import { User } from "../../config/dbConnection";

export const findUserPreferences = (userId: number) =>
  User.findByPk(userId, { attributes: ["id", "notifyChat", "notifyTask", "notifyMeeting"] });

export const updateUserPreferences = (userId: number, updates: Record<string, boolean>) =>
  User.update(updates, { where: { id: userId } });
