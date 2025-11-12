import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from 'express';

import cors from "cors";
import path from "path";

import { connectDB } from "./config/dbConnection";
import adminRouter from "./app/router/admin";
import UserRouter from './app/router/user'
import swaggerUi from 'swagger-ui-express';

const swaggerFile = require(path.join(__dirname, '../swagger-output.json'));// ✅ JSON import works if tsconfig is configured
const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "*"
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Serve uploads folder for images
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use('/admin', adminRouter);
app.use('/api',UserRouter)
// ✅ Swagger UI route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from TypeScript Express!');
});

app.listen(PORT, () => {
  connectDB();
  console.log(`Server is running on http://localhost:${PORT}`);
});
