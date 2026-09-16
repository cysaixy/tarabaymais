import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import {
  getSummaryAnalytics,
  getBarangayDistribution,
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

export default router;
