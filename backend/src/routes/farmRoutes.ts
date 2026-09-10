import { Router } from "express";
import { authenticate } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/rbacMiddleware";
import { createFarm, getMyFarms } from "../controllers/farmController";
import { Role } from "@prisma/client";

const router = Router();

router.use(authenticate); // Require valid Firebase token for all farm routes

router.post("/", authorize([Role.FARMER]), createFarm);
router.get("/", authorize([Role.FARMER, Role.TECHNICIAN]), getMyFarms);

export default router;
