import { Meeting } from "../config/dbConnection";
import admin from "firebase-admin";

// ✅ Initialize Firebase Admin SDK
// Using static import ensures TypeScript copies the file to the dist/ directory.
import serviceAccount from "../Notigication/salesvera-firebase-adminsdk-fbsvc-28c5e29ae4.json";

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    console.log("🔥 Firebase Admin SDK initialized successfully.");
  }
} catch (error) {
  console.error("❌ Firebase Admin initialization error:", error);
}

export interface NotifyPayload {
  token: string | string[]; // accepts single or multiple
  title: string;
  body: string;
  data?: Record<string, string>; // optional
}

export const sendPushNotification = async ({
  token,
  title,
  body,
  data = {},
}: NotifyPayload) => {
  try {
    if (!token || (Array.isArray(token) && token.length === 0)) {
      return { success: false, error: "No valid tokens provided" };
    }

    // ✅ Case A → Single Device
    if (typeof token === "string") {
      const message: admin.messaging.Message = {
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

      const response = await admin.messaging().send(message);
      console.log("✅ Push sent to single device:", response);
      return { success: true, response };
    }

    // ✅ Case B → Multiple Devices (Multicast)
    else if (Array.isArray(token)) {
      const message: admin.messaging.MulticastMessage = {
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

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Push sent to ${response.successCount} devices. Failures: ${response.failureCount}`);
      return { success: true, response };
    }

    return { success: false, error: "Invalid token type" };
  } catch (error) {
    console.error("❌ Push send error:", error);
    return { success: false, error };
  }
};


import { Request, Response } from "express";
import { Device } from "../config/dbConnection";

export const sendNewChatNotification = async (req: Request, res: Response): Promise<void> => {
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
    const devices = await Device.findAll({
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

    // 2️⃣ Extract tokens
    const tokens = devices.map(d => d.deviceToken).filter(t => !!t);
    console.log(`🎫 Tokens extracted: ${tokens.length}`);

    if (tokens.length === 0) {
      console.warn("⚠️ No valid device tokens found even though devices exist.");
      res.status(200).json({ success: true, message: "No valid tokens found." });
      return;
    }

    // 3️⃣ Send Push Notification
    console.log("🚀 Triggering Firebase Cloud Messaging...");
    const result = await sendPushNotification({
      token: tokens,
      title,
      body,
      data: data
    });

    if (result.success) {
      console.log("✨ Firebase push notification generated and sent successfully!");
      res.status(200).json({ success: true, message: "Chat notification sent to devices", result });
    } else {
      console.error("❌ Firebase failed to send notification:", result.error);
      res.status(500).json({ success: false, message: "Failed to send push notification", error: result.error });
    }

  } catch (error) {
    console.error("❌ sendNewChatNotification Critical Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
  console.log("--------------------------------------------------");
};
