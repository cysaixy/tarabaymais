import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import {
  getOverview,
  getCropStages,
  getScanTrends,
  getTopIssues,
  getDisasters,
  getFarmsGeo,
  getQueue,
} from "../controllers/officerAnalyticsController";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate);

// Officer analytics dashboard — Officers and Technicians
router.get(
  "/analytics/overview",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getOverview,
);

router.get(
  "/analytics/crop-stages",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getCropStages,
);

router.get(
  "/analytics/scan-trends",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getScanTrends,
);

router.get(
  "/analytics/top-issues",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getTopIssues,
);

router.get(
  "/analytics/disasters",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getDisasters,
);

router.get(
  "/farms/geo",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getFarmsGeo,
);

router.get(
  "/queue",
  authorize([Role.OFFICER, Role.TECHNICIAN]),
  getQueue,
);

export default router;
