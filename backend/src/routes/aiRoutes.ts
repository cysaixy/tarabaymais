import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { upload } from "../middlewares/uploadMiddleware";
import { scanCropHealth } from "../controllers/aiController";
import { handleRagChat } from "../controllers/rag.controller";

const router = Router();

router.use(authenticate);

// Endpoint for farmers/technicians to scan leaf photos
router.post("/scan", upload.single("image"), scanCropHealth);

// Endpoint for grounded RAG chat
router.post("/chat", handleRagChat);

export default router;
