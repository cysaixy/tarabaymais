import { Router } from "express";

import { upload } from "../middlewares/uploadMiddleware";
import {
  logCropActivity,
  createObservation,
} from "../controllers/activityController";
import { authorize } from "../middlewares/rbacMiddleware";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticate);

// Farmer Activity & Observation Routes
router.post(
  "/activities/:cropCycleId",
  authorize([Role.FARMER]),
  logCropActivity,
);
router.post(
  "/observations/:cropCycleId",
  upload.single("image"),
  authorize([Role.FARMER]),
  createObservation,
);

export default router;
