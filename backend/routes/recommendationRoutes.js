import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  applyRecommendation,
  getRecommendations,
  previewRecommendation,
} from "../controllers/recommendationController.js";

const router = express.Router();

router.get("/", protect, getRecommendations);
router.get("/:id/preview", protect, previewRecommendation);
router.post("/:id/apply", protect, applyRecommendation);

export default router;
