import { Router } from "express";
import { upload } from "../middlewares/uploadMiddleware";
import {
  logCropActivity,
  createObservation,
  getCropActivities,
  getCropObservations,
} from "../controllers/activityController";
import { authorize } from "../middlewares/rbacMiddleware";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticate);

// Farmer Activity & Observation Routes
router.get(
  "/activities",
  authorize([Role.FARMER, Role.TECHNICIAN, Role.OFFICER]),
  getCropActivities,
);
router.get(
  "/activities/:cropCycleId",
  authorize([Role.FARMER, Role.TECHNICIAN, Role.OFFICER]),
  getCropActivities,
);
router.post(
  "/activities/:cropCycleId",
  authorize([Role.FARMER]),
  logCropActivity,
);

router.get(
  "/observations",
  authorize([Role.FARMER, Role.TECHNICIAN, Role.OFFICER]),
  getCropObservations,
);
router.get(
  "/observations/:cropCycleId",
  authorize([Role.FARMER, Role.TECHNICIAN, Role.OFFICER]),
  getCropObservations,
);
router.post(
  "/observations/:cropCycleId",
  upload.single("image"),
  authorize([Role.FARMER]),
  createObservation,
);

export default router;
