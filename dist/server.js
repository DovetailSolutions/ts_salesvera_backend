"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const dbConnection_1 = require("./config/dbConnection");
const admin_1 = __importDefault(require("./app/router/admin"));
const user_1 = __importDefault(require("./app/router/user"));
const permission_1 = __importDefault(require("./app/router/permission"));
const task_1 = __importDefault(require("./app/router/task"));
const bulkSync_1 = __importDefault(require("./app/router/bulkSync"));
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
        origin: "*",
        credentials: true,
    },
});
(0, chat_1.initChatSocket)(io);
(0, task_2.initTaskSocket)(io);
// Register io so notificationService can deliver real-time events
(0, notificationService_1.registerIo)(io);
// Listen for socket connections
io.on("connection", (socket) => {
    var _a, _b;
    // Track userId → socketId for targeted notifications
    const rawUserId = (_b = (_a = socket.data) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.userId;
    if (rawUserId) {
        const userId = Number(rawUserId); // ✅ Ensure it's a number
        (0, notificationService_1.setUserSocket)(userId, socket.id);
        socket.on("disconnect", () => {
            (0, notificationService_1.removeUserSocket)(userId, socket.id);
        });
    }
});
// Start server (IMPORTANT)
server.listen(PORT, () => {
    (0, dbConnection_1.connectDB)();
    (0, cronJobs_1.startCronJobs)(); // ⏰ Start scheduled cron jobs (auto punch-out at 11:59 PM IST)
    console.log(`Server is running on http://localhost:${PORT}`);
});
