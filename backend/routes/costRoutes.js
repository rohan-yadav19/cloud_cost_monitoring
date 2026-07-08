import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getCostSummary } from "../controllers/costController.js";

const router = express.Router();

router.get("/summary", protect, getCostSummary);

export default router;
