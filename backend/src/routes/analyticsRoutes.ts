import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import {
  getSummaryAnalytics,
  getBarangayDistribution,
  createCsvReport,
} from "../controllers/analyticsController";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

// Restricted to Officers and Technicians
router.get(
  "/summary",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getSummaryAnalytics,
);
router.get(
  "/barangays",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getBarangayDistribution,
);

// creates a Municipal CSV/Excel Export Utility
router.get(
  "/analytics-export",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  createCsvReport,
);

export default router;
