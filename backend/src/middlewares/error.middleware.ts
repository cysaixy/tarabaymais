import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Centralized error-handling middleware.
 *
 * Must be registered LAST in the Express middleware chain (after all routes).
 * Catches every error forwarded via `next(err)` — including those thrown inside
 * `asyncHandler`-wrapped controllers — and returns a uniform JSON response:
 *
 *   { "success": false, "error": "message", "details": ... }
 *
 * Prisma-specific errors (P-codes) are mapped to sensible HTTP statuses so
 * controllers do NOT need to handle them individually.
 */
export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // ── 1. Known operational error (thrown via ApiError) ──────────────────
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = {
      success: false,
      error: err.message,
    };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  // ── 2. Prisma client errors ────────────────────────────────────────────
  if (isPrismaError(err)) {
    const { status, message } = mapPrismaError(err);
    res.status(status).json({ success: false, error: message });
    return;
  }

  // ── 3. Generic / unexpected errors ────────────────────────────────────
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";

  // Never leak internal stack traces in production
  const details =
    process.env.NODE_ENV !== "production" && err instanceof Error
      ? err.stack
      : undefined;

  const body: Record<string, unknown> = { success: false, error: message };
  if (details) body.details = details;

  res.status(500).json(body);
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Loosely identifies Prisma client known-request errors. */
function isPrismaError(err: unknown): err is { code: string; message: string } {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const code = (err as { code?: unknown }).code;

  return typeof code === "string" && code.startsWith("P");
}

function mapPrismaError(err: { code: string }): {
  status: number;
  message: string;
} {
  switch (err.code) {
    case "P2002":
      return {
        status: 409,
        message: "A record with that value already exists",
      };
    case "P2025":
      return { status: 404, message: "Record not found" };
    case "P2003":
      return { status: 409, message: "Related record not found (foreign key)" };
    default:
      return { status: 500, message: "Database operation failed" };
  }
}
