import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import {
  createFarm,
  getMyFarms,
  updateFarm,
  deleteFarm,
} from "../controllers/farmController";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate); // Require valid Firebase token for all farm routes

router.post("/", authorize([Role.FARMER]), createFarm);
router.get("/", authorize([Role.FARMER, Role.TECHNICIAN]), getMyFarms);

router.patch("/:farmId", authorize([Role.FARMER]), updateFarm);
router.delete("/:farmId", authorize([Role.FARMER]), deleteFarm);

export default router;
