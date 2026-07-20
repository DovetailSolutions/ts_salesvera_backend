import dotenv from "dotenv";
dotenv.config();

// Validate required env vars before anything else loads (fails fast instead
// of silently falling back to insecure defaults).
import "./config/env";

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import http from "http";

import { connectDB, sequelize } from "./config/dbConnection";
import { ensureLeaveTypeSchema, ensureEmployeeCode, ensureNotificationPreferences } from "./config/schemaExtensions";
import adminRouter from "./app/router/admin";
import UserRouter from "./app/router/user";
import permissionRouter from "./app/router/permission";
import taskRouter from "./app/router/task";
import bulkSyncRouter from "./app/router/bulkSync";
import holidayRoutes from "./modules/holiday/holiday.routes";
import branchRoutes from "./modules/branch/branch.routes";
import shiftRoutes from "./modules/shift/shift.routes";
import departmentRoutes from "./modules/department/department.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import attendanceSelfRoutes from "./modules/attendance/attendanceSelf.routes";
import companyRoutes from "./modules/company/company.routes";
import authRoutes from "./modules/auth/auth.routes";
import preferencesRoutes from "./modules/preferences/preferences.routes";
import swaggerUi from "swagger-ui-express";
import { initChatSocket } from "./Notigication/chat";
import { initTaskSocket } from "./Notigication/task";
import { registerIo } from "./config/notificationService";
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
app.use(express.json({ limit: "50mb" }));
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
// Modular backend architecture — extracted domains mount here, same URL
// paths as their old admin.ts equivalents. See src/modules/.
app.use("/admin", holidayRoutes);
app.use("/admin", branchRoutes);
app.use("/admin", shiftRoutes);
app.use("/admin", departmentRoutes);
app.use("/admin", leaveRoutes);
app.use("/admin", attendanceRoutes);
app.use("/api", attendanceSelfRoutes);
app.use("/admin", companyRoutes);
app.use("/admin", authRoutes);
app.use("/admin", preferencesRoutes);

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
    origin: true, // reflect request origin — required when credentials: true (can't combine with "*")
    credentials: true,
  },
});

initChatSocket(io);
initTaskSocket(io);

// Register io so notificationService can deliver real-time events
registerIo(io);

// Start server (IMPORTANT)
server.listen(PORT, async () => {
  await connectDB();
  await ensureLeaveTypeSchema(sequelize);
  await ensureEmployeeCode(sequelize);
  await ensureNotificationPreferences(sequelize);
  startCronJobs(); // ⏰ Start scheduled cron jobs (auto punch-out at 11:59 PM IST)
  console.log(`Server is running on http://localhost:${PORT}`);
});
