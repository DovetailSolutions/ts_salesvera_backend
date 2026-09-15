import dotenv from "dotenv";
dotenv.config();

// Validate required env vars before anything else loads (fails fast instead
// of silently falling back to insecure defaults).
import { FRONTEND_URL } from "./config/env";

import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import http from "http";

import { connectDB, sequelize } from "./config/dbConnection";
import { ensureLeaveTypeSchema, ensureEmployeeCode, ensureNotificationPreferences, ensureChatRoomOwnership, ensureBranchVisibilityToggle, ensureCompanyBrandingColumns, ensureTallyMastersSchema, ensureEmployeeExtraDetailsSchema, ensureEmployeeBankAccountsSchema } from "./config/schemaExtensions";
import adminRouter from "./app/router/admin";
import UserRouter from "./app/router/user";
import permissionRouter from "./app/router/permission";
import taskRouter from "./app/router/task";
import bulkSyncRouter from "./app/router/bulkSync";
import holidayRoutes from "./modules/holiday/holiday.routes";
import branchRoutes from "./modules/branch/branch.routes";
import shiftRoutes from "./modules/shift/shift.routes";
import allocationRoutes from "./modules/allocation/allocation.routes";
import departmentRoutes from "./modules/department/department.routes";
import leaveRoutes from "./modules/leave/leave.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import attendanceSelfRoutes from "./modules/attendance/attendanceSelf.routes";
import geoFencingRoutes from "./modules/geoFencing/geoFencing.routes";
import attendanceSecurityRoutes from "./modules/attendanceSecurity/attendanceSecurity.routes";
import attendanceRegularizationRoutes from "./modules/attendanceRegularization/attendanceRegularization.routes";
import attendanceRegularizationSelfRoutes from "./modules/attendanceRegularization/attendanceRegularizationSelf.routes";
import companyRoutes from "./modules/company/company.routes";
import authRoutes from "./modules/auth/auth.routes";
import preferencesRoutes from "./modules/preferences/preferences.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import meetingRoutes from "./modules/meeting/meeting.routes";
import { contactPublicRoutes, contactAdminRoutes } from "./modules/contact/contact.routes";
import superAdminRoutes from "./modules/superAdmin/superAdmin.routes";
import setupTrackingRoutes from "./modules/setupTracking/setupTracking.routes";
import announcementRoutes from "./modules/announcement/announcement.routes";
import managerCapabilitiesRoutes from "./modules/managerCapabilities/managerCapabilities.routes";
import employeeProfileRoutes from "./modules/employeeProfile/employeeProfile.routes";
import swaggerUi from "swagger-ui-express";
import { initChatSocket } from "./Notigication/chat";
import { initTaskSocket } from "./Notigication/task";
import { initAnnouncementSocket } from "./Notigication/announcement";
import { registerIo } from "./config/notificationService";
import { startCronJobs } from "./config/cronJobs";
import { startAnnouncementCronJobs } from "./config/announcementCron";
import { Server } from "socket.io";

const swaggerFile = require(path.join(__dirname, "../swagger-output.json"));
const app = express();
const PORT = process.env.PORT || 5000;

// FIX: was `origin: true` (reflects and allows ANY request origin) — fine
// with credentials:true as long as the only credential in play was a
// Bearer token a page has to deliberately attach in JS, but now that
// /admin/login sets a real browser-managed cookie, ANY origin being
// allowed to make credentialed requests means any site could trigger
// authenticated requests carrying it. Restricted to an explicit allowlist
// (FRONTEND_URL, comma-separated for more than one legitimate origin —
// e.g. a staging environment) instead. Requests with no Origin header at
// all (curl, Postman, server-to-server, the mobile app) are still allowed
// through — CORS only ever governs browser-enforced cross-origin reads,
// it was never what protected non-browser callers.
const allowedOrigins = FRONTEND_URL.split(",").map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`CORS: rejected request from unlisted origin "${origin}" — add it to FRONTEND_URL if legitimate.`);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(cookieParser());
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
app.use("/admin", allocationRoutes);
app.use("/admin", departmentRoutes);
app.use("/admin", leaveRoutes);
app.use("/admin", attendanceRoutes);
app.use("/api", attendanceSelfRoutes);
app.use("/api", attendanceRegularizationSelfRoutes);
app.use("/admin", geoFencingRoutes);
app.use("/admin", attendanceSecurityRoutes);
app.use("/admin", attendanceRegularizationRoutes);
app.use("/admin", companyRoutes);
app.use("/admin", authRoutes);
app.use("/admin", preferencesRoutes);
app.use("/admin", reportsRoutes);
app.use("/admin", meetingRoutes);
app.use("/admin", announcementRoutes);
app.use("/admin", managerCapabilitiesRoutes);
app.use("/admin", employeeProfileRoutes);
app.use("/api", contactPublicRoutes);
app.use("/admin", contactAdminRoutes);
// setupTrackingRoutes is mounted BEFORE superAdminRoutes on purpose — see
// the FIX note in superAdmin.routes.ts: a path-less router.use(tokenCheck)
// there previously shadowed any route mounted after it.
app.use("/admin", setupTrackingRoutes);
app.use("/admin", superAdminRoutes);

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
initAnnouncementSocket(io);

// Register io so notificationService can deliver real-time events
registerIo(io);

// Start server (IMPORTANT)
server.listen(PORT, async () => {
  await connectDB();
  await ensureLeaveTypeSchema(sequelize);
  await ensureEmployeeCode(sequelize);
  await ensureNotificationPreferences(sequelize);
  await ensureChatRoomOwnership(sequelize);
  await ensureBranchVisibilityToggle(sequelize);
  await ensureCompanyBrandingColumns(sequelize);
  await ensureTallyMastersSchema(sequelize);
  await ensureEmployeeExtraDetailsSchema(sequelize);
  await ensureEmployeeBankAccountsSchema(sequelize);
  startCronJobs(); // ⏰ Start scheduled cron jobs (auto punch-out at 11:59 PM IST)
  startAnnouncementCronJobs(); // ⏰ Publish scheduled announcements once due
  console.log(`Server is running on http://localhost:${PORT}`);
});
