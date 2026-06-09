import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import http from "http";

import { connectDB } from "./config/dbConnection";
import adminRouter from "./app/router/admin";
import UserRouter from "./app/router/user";
import permissionRouter from "./app/router/permission";
import taskRouter from "./app/router/task";
import bulkSyncRouter from "./app/router/bulkSync";
import swaggerUi from "swagger-ui-express";
import { initChatSocket } from "./Notigication/chat";
import { initTaskSocket } from "./Notigication/task";
import { registerIo, setUserSocket, removeUserSocket } from "./config/notificationService";
import { startCronJobs } from "./config/cronJobs";

const swaggerFile = require(path.join(__dirname, "../swagger-output.json"));
const app = express();
const PORT = process.env.PORT || 5000;
app.use(
  cors({
    origin: true, // reflect request origin
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ✅ Global JSON syntax error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON format in request body",
    });
  }
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/admin", adminRouter);
app.use("/api", UserRouter);
app.use("/admin/permissions", permissionRouter);
app.use("/admin/task", taskRouter);
app.use("/admin/bulk", bulkSyncRouter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile, {
  swaggerOptions: {
    requestInterceptor: (req: any) => {
      req.headers["ngrok-skip-browser-warning"] = "true";
      return req;
    }
  }
}));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from TypeScript Express!");
});

import { Server } from "socket.io";

// Create HTTP server (IMPORTANT)
const server = http.createServer(app);

// Initialize socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

initChatSocket(io);
initTaskSocket(io);

// Register io so notificationService can deliver real-time events
registerIo(io);

// Listen for socket connections
io.on("connection", (socket) => {
  // Track userId → socketId for targeted notifications
  const rawUserId = socket.data?.user?.userId;
  if (rawUserId) {
    const userId = Number(rawUserId); // ✅ Ensure it's a number
    setUserSocket(userId, socket.id);
    
    socket.on("disconnect", () => {
      removeUserSocket(userId, socket.id);
    });
  }
});

// Start server (IMPORTANT)
server.listen(PORT, () => {
  connectDB();
  startCronJobs(); // ⏰ Start scheduled cron jobs (auto punch-out at 11:59 PM IST)
  console.log(`Server is running on http://localhost:${PORT}`);
});
