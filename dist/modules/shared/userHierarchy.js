"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllChildUserIds = getAllChildUserIds;
exports.getDirectCreator = getDirectCreator;
const dbConnection_1 = require("../../config/dbConnection");
// Walks the createdBy/createdUsers self-referential chain to collect every
// user (at any depth) that the given userId created, directly or through an
// intermediate manager. Used throughout admin/leave/attendance/expense
// endpoints to scope "my team" queries — extracted verbatim from admin.ts.
function getAllChildUserIds(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = new Set();
        function fetchLevel(id) {
            return __awaiter(this, void 0, void 0, function* () {
                const user = (yield dbConnection_1.User.findByPk(id, {
                    include: [
                        {
                            model: dbConnection_1.User,
                            as: "createdUsers",
                            attributes: ["id"],
                            through: { attributes: [] },
                        },
                    ],
                }));
                if (!(user === null || user === void 0 ? void 0 : user.createdUsers))
                    return;
                for (const child of user.createdUsers) {
                    if (!result.has(child.id)) {
                        result.add(child.id);
                        yield fetchLevel(child.id);
                    }
                }
            });
        }
        yield fetchLevel(userId);
        return Array.from(result);
    });
}
// Returns the given user's immediate creator (one level up the createdBy
// chain) — e.g. a sale_person's direct manager, or a manager's direct
// admin. Used to route "task completed" / other escalation notifications
// to the right person without walking the whole chain. Returns null if the
// user has no creator (e.g. a tenant-root "user" or super_admin).
function getDirectCreator(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const user = (yield dbConnection_1.User.findByPk(userId, {
            include: [
                {
                    model: dbConnection_1.User,
                    as: "creators",
                    attributes: ["id", "role"],
                    through: { attributes: [] },
                },
            ],
        }));
        const plain = (user === null || user === void 0 ? void 0 : user.get) ? user.get({ plain: true }) : user;
        const creator = (_a = plain === null || plain === void 0 ? void 0 : plain.creators) === null || _a === void 0 ? void 0 : _a[0];
        return creator ? { id: creator.id, role: creator.role } : null;
    });
}
