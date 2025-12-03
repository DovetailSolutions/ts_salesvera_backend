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
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const chat_1 = require("./Notigication/chat");
const swaggerFile = require(path_1.default.join(__dirname, "../swagger-output.json"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
    "http://localhost:5173",
    "https://salesvera.com",
    "https://www.salesvera.com",
    "https://api.salesvera.com",
];
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/admin", admin_1.default);
app.use("/api", user_1.default);
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerFile));
app.get("/", (req, res) => {
    res.send("Hello from TypeScript Express!");
});
const socket_io_1 = require("socket.io");
// Create HTTP server (IMPORTANT)
const server = http_1.default.createServer(app);
// Initialize socket.io
const io = new socket_io_1.Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});
(0, chat_1.initChatSocket)(io);
// Listen for socket connections
// io.on("connection", (socket) => {
//   console.log("User connected:", socket.id);
// });
// Start server (IMPORTANT)
server.listen(PORT, () => {
    (0, dbConnection_1.connectDB)();
    console.log(`Server is running on http://localhost:${PORT}`);
});
