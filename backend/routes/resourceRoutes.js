import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getResources } from "../controllers/resourceController.js";

const router = express.Router();

router.get("/", protect, getResources);

export default router;
