import { Router } from "express";
import { syncUser } from "../controllers/authController";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

router.post("/sync", authenticate, syncUser);

export default router;
