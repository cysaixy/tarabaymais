import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import {
  createCropCycle,
  getFarmCropCycles,
  updateCropCycleStatus,
} from "../controllers/cropCycleController";
import { Role } from "@prisma/client";
const router = Router();

router.use(authenticate);

// Farm-nested crop cycle operations
router.post("/farm/:farmId", authorize([Role.FARMER]), createCropCycle);
router.get(
  "/farm/:farmId",
  authorize([Role.FARMER, Role.TECHNICIAN]),
  getFarmCropCycles,
);

// Direct crop cycle status update
router.patch("/:id/status", authorize([Role.FARMER]), updateCropCycleStatus);

export default router;
