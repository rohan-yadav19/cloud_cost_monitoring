import express from "express";

import {
  signup,
  login,
  logout,
  getProfile,
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Routes
router.post("/signup", signup);
router.post("/login", login);

// Protected Routes
router.post("/logout", protect, logout);
router.get("/profile", protect, getProfile);

export default router;
