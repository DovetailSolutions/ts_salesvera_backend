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
exports.upsertConfig = exports.findUserById = exports.findConfigByUserId = void 0;
const dbConnection_1 = require("../../config/dbConnection");
const findConfigByUserId = (userId) => dbConnection_1.UserGeoFencing.findOne({ where: { userId } });
exports.findConfigByUserId = findConfigByUserId;
const findUserById = (userId) => dbConnection_1.User.findByPk(userId, {
    attributes: ["id", "firstName", "lastName", "email", "role", "status"],
});
exports.findUserById = findUserById;
const upsertConfig = (userId, companyId, actorId, data) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const existing = yield (0, exports.findConfigByUserId)(userId);
    if (existing) {
        existing.enabled = data.enabled;
        existing.latitude = data.latitude;
        existing.longitude = data.longitude;
        existing.radius = data.radius;
        existing.radiusUnit = data.radiusUnit;
        if (data.locationName !== undefined)
            existing.locationName = data.locationName;
        if (data.landmark !== undefined)
            existing.landmark = data.landmark;
        if (data.address !== undefined)
            existing.address = data.address;
        if (data.city !== undefined)
            existing.city = data.city;
        existing.updatedBy = actorId;
        if (companyId != null)
            existing.companyId = companyId;
        yield existing.save();
        return existing;
    }
    return dbConnection_1.UserGeoFencing.create({
        userId,
        companyId,
        enabled: data.enabled,
        latitude: data.latitude,
        longitude: data.longitude,
        radius: data.radius,
        radiusUnit: data.radiusUnit,
        locationName: (_a = data.locationName) !== null && _a !== void 0 ? _a : null,
        landmark: (_b = data.landmark) !== null && _b !== void 0 ? _b : null,
        address: (_c = data.address) !== null && _c !== void 0 ? _c : null,
        city: (_d = data.city) !== null && _d !== void 0 ? _d : null,
        createdBy: actorId,
        updatedBy: actorId,
    });
});
exports.upsertConfig = upsertConfig;
