import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { upload } from "../middlewares/uploadMiddleware";
import { scanCropHealth } from "../controllers/aiController";

const router = Router();

router.use(authenticate);

// Endpoint for farmers/technicians to scan leaf photos
router.post("/scan", upload.single("image"), scanCropHealth);

export default router;
