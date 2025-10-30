import{Meeting} from "../config/dbConnection"
import admin from "firebase-admin";
// import serviceAccount from '../Notigication/notification.json' ;

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
// });


export interface NotifyPayload {
  token: string | string[];   // accepts single or multiple
  title: string;
  body: string;
  data?: Record<string, string>;   // optional
}

export const sendPushNotification = async ({
  token,
  title,
  body,
  data = {},
}: NotifyPayload) => {
  try {
    // ✅ Case A → Single Device
    if (typeof token === "string") {
      const message: admin.messaging.Message = {
        token,
        notification: { title, body },
        data,
      };

      const response = await admin.messaging().send(message);
      console.log("✅ Sent to single device:", response);

      return { success: true, response };
    }

    // ✅ Case B → Multiple Devices
    else if (Array.isArray(token)) {
      const message: admin.messaging.MulticastMessage = {
        tokens: token,
        notification: { title, body },
        data,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      console.log("✅ Sent to multiple devices:", response);

      return { success: true, response };
    }

    return { success: false, error: "Invalid token type" };
  } catch (error) {
    console.error("❌ Push send error:", error);
    return { success: false, error };
  }
};


export const sheduleNotification = async(req:Request,res:Response):Promise<void>=>{
    try{


    }catch(error){
        console.log(error)
    }
}
