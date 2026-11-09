import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import {
  getUnifiedCases,
  updateCaseStatus,
  createDisasterReport,
  resolveExpertCase,
  uploadDisasterPhotos,
} from "../controllers/caseController";
import { upload } from "../middlewares/uploadMiddleware";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

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

// Farmer submits disaster claim
router.post(
  "/disaster-report/:farmId",
  authorize([Role.FARMER]),
  createDisasterReport,
);

// Upload inspection / farmer-evidence photos (up to 3) for a disaster report
router.post(
  "/disaster-report/:caseId/photos",
  authorize([Role.FARMER, Role.TECHNICIAN, Role.OFFICER]),
  upload.array("photos", 3),
  uploadDisasterPhotos,
);

// Technician/Officer resolves an expert request with diagnostic notes
router.patch(
  "/expert-requests/:caseId/resolve",
  authorize([Role.TECHNICIAN, Role.OFFICER]),
  resolveExpertCase,
);
export default router;
