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
exports.sendNewChatNotification = exports.sendPushNotification = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// ✅ Initialize Firebase Admin SDK
// Using static import ensures TypeScript copies the file to the dist/ directory.
const salesvera_firebase_adminsdk_fbsvc_28c5e29ae4_json_1 = __importDefault(require("../Notigication/salesvera-firebase-adminsdk-fbsvc-28c5e29ae4.json"));
try {
    if (!firebase_admin_1.default.apps.length) {
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(salesvera_firebase_adminsdk_fbsvc_28c5e29ae4_json_1.default),
        });
        console.log("🔥 Firebase Admin SDK initialized successfully.");
    }
}
catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
}
const sendPushNotification = (_a) => __awaiter(void 0, [_a], void 0, function* ({ token, title, body, data = {}, }) {
    try {
        if (!token || (Array.isArray(token) && token.length === 0)) {
            return { success: false, error: "No valid tokens provided" };
        }
        // ✅ Case A → Single Device
        if (typeof token === "string") {
            const message = {
                token,
                notification: { title, body },
                data,
                android: {
                    priority: "high",
                    notification: {
                        sound: "default",
                        clickAction: "FLUTTER_NOTIFICATION_CLICK", // or your app's action
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: "default",
                            badge: 1,
                        },
                    },
                },
            };
            const response = yield firebase_admin_1.default.messaging().send(message);
            console.log("✅ Push sent to single device:", response);
            return { success: true, response };
        }
        // ✅ Case B → Multiple Devices (Multicast)
        else if (Array.isArray(token)) {
            const message = {
                tokens: token,
                notification: { title, body },
                data,
                android: {
                    priority: "high",
                    notification: {
                        sound: "default",
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: "default",
                            badge: 1,
                        },
                    },
                },
            };
            const response = yield firebase_admin_1.default.messaging().sendEachForMulticast(message);
            console.log(`✅ Push sent to ${response.successCount} devices. Failures: ${response.failureCount}`);
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
const dbConnection_1 = require("../config/dbConnection");
const sendNewChatNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("--------------------------------------------------");
    console.log("📨 Incoming Request to sendNewChatNotification");
    try {
        const { receiverId, title, body, data = {} } = req.body;
        console.log(`👤 Target Receiver ID: ${receiverId}`);
        console.log(`📝 Title: ${title} | Body: ${body}`);
        if (!receiverId || !title || !body) {
            console.warn("⚠️ Missing required fields in request body.");
            res.status(400).json({ success: false, message: "receiverId, title, and body are required" });
            return;
        }
        // 1️⃣ Find all active devices for this user
        console.log(`🔍 Fetching active devices from DB for user ${receiverId}...`);
        const devices = yield dbConnection_1.Device.findAll({
            where: {
                userId: Number(receiverId),
                isActive: true
            }
        });
        if (devices.length === 0) {
            console.log(`📵 No active devices found in DB for user ${receiverId}.`);
            res.status(200).json({ success: true, message: "No devices found, no push sent." });
            return;
        }
        console.log(`✅ Found ${devices.length} active device(s).`);
        const tokens = devices.map(d => d.deviceToken).filter(t => !!t);
        console.log(`🎫 Tokens extracted: ${tokens.length}`);
        if (tokens.length === 0) {
            console.warn("⚠️ No valid device tokens found even though devices exist.");
            res.status(200).json({ success: true, message: "No valid tokens found." });
            return;
        }
        // Prepare data payload for Firebase
        const firebaseData = {};
        Object.entries(data).forEach(([key, value]) => {
            firebaseData[key] = String(value);
        });
        // Add type if provided
        if (req.body.type) {
            firebaseData.type = String(req.body.type);
        }
        else {
            firebaseData.type = "chat"; // Default to chat since it's sendNewChatNotification
        }
        // 3️⃣ Send Push Notification
        console.log("🚀 Triggering Firebase Cloud Messaging...");
        const result = yield (0, exports.sendPushNotification)({
            token: tokens,
            title,
            body,
            data: firebaseData
        });
        if (result.success) {
            console.log("✨ Firebase push notification generated and sent successfully!");
            res.status(200).json({ success: true, message: "Chat notification sent to devices", result });
        }
        else {
            console.error("❌ Firebase failed to send notification:", result.error);
            res.status(500).json({ success: false, message: "Failed to send push notification", error: result.error });
        }
    }
    catch (error) {
        console.error("❌ sendNewChatNotification Critical Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
    console.log("--------------------------------------------------");
});
exports.sendNewChatNotification = sendNewChatNotification;
