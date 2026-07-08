import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import costRoutes from "./routes/costRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";

// Load environment variables
dotenv.config();

const app = express();

// =====================
// Middlewares
// =====================
app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// =====================
// Home Route
// =====================
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Cloud Cost Monitoring Backend API is running 🚀",
  });
});

// =====================
// Routes
// =====================
app.use("/api/auth", authRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/costs", costRoutes);
app.use("/api/recommendations", recommendationRoutes);

// =====================
// 404 Route
// =====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found",
  });
});

export default app;
