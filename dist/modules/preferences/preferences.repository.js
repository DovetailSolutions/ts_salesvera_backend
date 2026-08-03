"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserPreferences = exports.findUserPreferences = void 0;
const dbConnection_1 = require("../../config/dbConnection");
const findUserPreferences = (userId) => dbConnection_1.User.findByPk(userId, { attributes: ["id", "notifyChat", "notifyTask", "notifyMeeting"] });
exports.findUserPreferences = findUserPreferences;
const updateUserPreferences = (userId, updates) => dbConnection_1.User.update(updates, { where: { id: userId } });
exports.updateUserPreferences = updateUserPreferences;
