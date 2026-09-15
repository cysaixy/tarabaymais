import { Router } from "express";
import { syncUser } from "../controllers/authController";
import { authenticate } from "../middlewares/authMiddleware";
import { registerFcmToken } from "../controllers/user.controller";

const router = Router();

router.use(authenticate);

router.post("/fcm-token", registerFcmToken);

export default router;
