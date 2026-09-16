import { Router } from "express";
import { exportAnalyticsReport } from "../controllers/analytics.controller";
import { authorize } from "../middlewares/rbacMiddleware";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();
router.use(authenticate);

// Endpoint: GET /api/v1/analytics/export
router.get(
  "/export",
  authorize([Role.TECHNICIAN, Role.OFFICER]),
  exportAnalyticsReport,
);

export default router;
