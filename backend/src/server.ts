import "dotenv/config";
// Environment configuration updated with Google Gemini AI key
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes";
import farmRoutes from "./routes/farmRoutes";
import cropCycleRoutes from "./routes/cropCycleRoutes";
import caseRoutes from "./routes/caseRoutes";
import aiRoutes from "./routes/aiRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import activityRoutes from "./routes/activityRoutes";
import userRoutes from "./routes/user.routes";
import syncRoutes from "./routes/sync.routes";

import { errorMiddleware } from "./middlewares/error.middleware";
import { closeCache } from "./lib/cache";

const app = express();
const port = process.env.PORT ?? 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173", // Vite
  "http://localhost:8081", // Expo / React Native Metro
  "http://10.0.2.2:8081", // Android emulator → host Metro
  "http://localhost:4173", // PWA preview
];

const envOrigins = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const allowedOrigins = [...defaultAllowedOrigins, ...envOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server (no Origin header) and whitelisted origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith(".vercel.app")) {
          return callback(null, true);
        }
      } catch {
        /* invalid origin URL */
      }
      return callback(new Error(`CORS: origin '${origin}' is not permitted`));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
/** Strict limiter for auth and AI endpoints */
const sensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // max 60 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests — please try again later",
  },
});

/** General API limiter */
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests — please try again later",
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", sensitiveRateLimiter, authRoutes);
app.use("/api/v1/ai", sensitiveRateLimiter, aiRoutes);

app.use("/api/v1/farm", generalRateLimiter, farmRoutes);
app.use("/api/v1/crop-cycles", generalRateLimiter, cropCycleRoutes);
app.use("/api/v1/case", generalRateLimiter, caseRoutes);
app.use("/api/v1/analytics", generalRateLimiter, analyticsRoutes);
app.use("/api/v1/", generalRateLimiter, activityRoutes);
app.use("/api/v1/register", generalRateLimiter, userRoutes);
app.use("/api/v1/sync", generalRateLimiter, syncRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

// ── Centralized error handler (MUST be last) ──────────────────────────────────
app.use(errorMiddleware);

const server = app.listen(port, () => {
  console.info(`[Server] Running at http://localhost:${port}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.info(`[Server] ${signal} received, shutting down gracefully...`);
  server.close(async () => {
    console.info("[Server] HTTP server closed");
    try {
      await closeCache();
      console.info("[Server] Redis connection closed");
    } catch (err) {
      console.error("[Server] Error closing Redis:", err);
    }
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error("[Server] Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
