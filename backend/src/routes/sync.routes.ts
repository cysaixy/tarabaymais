import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { processBatchSync } from "../controllers/sync.controller";

const router = Router();

router.use(authenticate);
router.post("/", processBatchSync);

export default router;
