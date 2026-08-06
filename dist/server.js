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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Validate required env vars before anything else loads (fails fast instead
// of silently falling back to insecure defaults).
require("./config/env");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const dbConnection_1 = require("./config/dbConnection");
const schemaExtensions_1 = require("./config/schemaExtensions");
const admin_1 = __importDefault(require("./app/router/admin"));
const user_1 = __importDefault(require("./app/router/user"));
const permission_1 = __importDefault(require("./app/router/permission"));
const task_1 = __importDefault(require("./app/router/task"));
const bulkSync_1 = __importDefault(require("./app/router/bulkSync"));
const holiday_routes_1 = __importDefault(require("./modules/holiday/holiday.routes"));
const branch_routes_1 = __importDefault(require("./modules/branch/branch.routes"));
const shift_routes_1 = __importDefault(require("./modules/shift/shift.routes"));
const allocation_routes_1 = __importDefault(require("./modules/allocation/allocation.routes"));
const department_routes_1 = __importDefault(require("./modules/department/department.routes"));
const leave_routes_1 = __importDefault(require("./modules/leave/leave.routes"));
const attendance_routes_1 = __importDefault(require("./modules/attendance/attendance.routes"));
const attendanceSelf_routes_1 = __importDefault(require("./modules/attendance/attendanceSelf.routes"));
const company_routes_1 = __importDefault(require("./modules/company/company.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const preferences_routes_1 = __importDefault(require("./modules/preferences/preferences.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const meeting_routes_1 = __importDefault(require("./modules/meeting/meeting.routes"));
const contact_routes_1 = require("./modules/contact/contact.routes");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const chat_1 = require("./Notigication/chat");
const task_2 = require("./Notigication/task");
const notificationService_1 = require("./config/notificationService");
const cronJobs_1 = require("./config/cronJobs");
const swaggerFile = require(path_1.default.join(__dirname, "../swagger-output.json"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: true, // reflect request origin
    credentials: true,
}));
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
// ✅ Global JSON syntax error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON format in request body",
        });
    }
    next();
});
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/admin", admin_1.default);
app.use("/api", user_1.default);
app.use("/admin/permissions", permission_1.default);
app.use("/admin/task", task_1.default);
app.use("/admin/bulk", bulkSync_1.default);
// Modular backend architecture — extracted domains mount here, same URL
// paths as their old admin.ts equivalents. See src/modules/.
app.use("/admin", holiday_routes_1.default);
app.use("/admin", branch_routes_1.default);
app.use("/admin", shift_routes_1.default);
app.use("/admin", allocation_routes_1.default);
app.use("/admin", department_routes_1.default);
app.use("/admin", leave_routes_1.default);
app.use("/admin", attendance_routes_1.default);
app.use("/api", attendanceSelf_routes_1.default);
app.use("/admin", company_routes_1.default);
app.use("/admin", auth_routes_1.default);
app.use("/admin", preferences_routes_1.default);
app.use("/admin", reports_routes_1.default);
app.use("/admin", meeting_routes_1.default);
app.use("/api", contact_routes_1.contactPublicRoutes);
app.use("/admin", contact_routes_1.contactAdminRoutes);
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerFile, {
    swaggerOptions: {
        requestInterceptor: (req) => {
            req.headers["ngrok-skip-browser-warning"] = "true";
            return req;
        }
    }
}));
app.get("/", (req, res) => {
    res.send("Hello from TypeScript Express!");
});
const socket_io_1 = require("socket.io");
// Create HTTP server (IMPORTANT)
const server = http_1.default.createServer(app);
// Initialize socket.io
const io = new socket_io_1.Server(server, {
    cors: {
        origin: true, // reflect request origin — required when credentials: true (can't combine with "*")
        credentials: true,
    },
});
(0, chat_1.initChatSocket)(io);
(0, task_2.initTaskSocket)(io);
// Register io so notificationService can deliver real-time events
(0, notificationService_1.registerIo)(io);
// Start server (IMPORTANT)
server.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, dbConnection_1.connectDB)();
    yield (0, schemaExtensions_1.ensureLeaveTypeSchema)(dbConnection_1.sequelize);
    yield (0, schemaExtensions_1.ensureEmployeeCode)(dbConnection_1.sequelize);
    yield (0, schemaExtensions_1.ensureNotificationPreferences)(dbConnection_1.sequelize);
    yield (0, schemaExtensions_1.ensureChatRoomOwnership)(dbConnection_1.sequelize);
    (0, cronJobs_1.startCronJobs)(); // ⏰ Start scheduled cron jobs (auto punch-out at 11:59 PM IST)
    console.log(`Server is running on http://localhost:${PORT}`);
}));
