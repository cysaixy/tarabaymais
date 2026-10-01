import { Router } from "express";
import { syncUser, getMe } from "../controllers/authController";
import { authenticate } from "../middlewares/authMiddleware";

const router = Router();

// First-time registration / idempotent profile creation.
router.post("/sync", authenticate, syncUser);

// Returns the authenticated caller's profile (role, names, farmerProfile).
router.get("/me", authenticate, getMe);

export default router;
