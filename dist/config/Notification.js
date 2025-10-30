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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sheduleNotification = exports.sendPushNotification = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const sendPushNotification = (_a) => __awaiter(void 0, [_a], void 0, function* ({ token, title, body, data = {}, }) {
    try {
        // ✅ Case A → Single Device
        if (typeof token === "string") {
            const message = {
                token,
                notification: { title, body },
                data,
            };
            const response = yield firebase_admin_1.default.messaging().send(message);
            console.log("✅ Sent to single device:", response);
            return { success: true, response };
        }
        // ✅ Case B → Multiple Devices
        else if (Array.isArray(token)) {
            const message = {
                tokens: token,
                notification: { title, body },
                data,
            };
            const response = yield firebase_admin_1.default.messaging().sendEachForMulticast(message);
            console.log("✅ Sent to multiple devices:", response);
            return { success: true, response };
        }
        return { success: false, error: "Invalid token type" };
    }
    catch (error) {
        console.error("❌ Push send error:", error);
        return { success: false, error };
    }
});
exports.sendPushNotification = sendPushNotification;
const sheduleNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
    }
    catch (error) {
        console.log(error);
    }
});
exports.sheduleNotification = sheduleNotification;
