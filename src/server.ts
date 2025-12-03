import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import http from "http";

import { connectDB } from "./config/dbConnection";
import adminRouter from "./app/router/admin";
import UserRouter from "./app/router/user";
import swaggerUi from "swagger-ui-express";
import { initChatSocket } from "./Notigication/chat";

const swaggerFile = require(path.join(__dirname, "../swagger-output.json"));
const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "https://salesvera.com",
  "https://www.salesvera.com",
  "https://api.salesvera.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin as string)) {
    res.header("Access-Control-Allow-Origin", origin as string);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/admin", adminRouter);
app.use("/api", UserRouter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from TypeScript Express!");
});

import { Server } from "socket.io";

// Create HTTP server (IMPORTANT)
const server = http.createServer(app);

// Initialize socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

initChatSocket(io);

// Listen for socket connections
// io.on("connection", (socket) => {
//   console.log("User connected:", socket.id);
// });

// Start server (IMPORTANT)
server.listen(PORT, () => {
  connectDB();
  console.log(`Server is running on http://localhost:${PORT}`);
});
