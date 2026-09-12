import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import {
  logCropActivity,
  createObservation,
} from "../controllers/activityController";
import {
  getUnifiedCases,
  updateCaseStatus,
} from "../controllers/caseController";
import { Role } from "@prisma/client";

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
  authorize([Role.FARMER]),
  createObservation,
);

// Unified Case Tracker (Farmers, Technicians, Officers)
router.get(
  "/pipeline",
  authorize([Role.FARMER, Role.TECHNICIAN, Role.OFFICER]),
  getUnifiedCases,
);
router.patch(
  "/pipeline/:caseId",
  authorize([Role.TECHNICIAN, Role.OFFICER]),
  updateCaseStatus,
);

export default router;
