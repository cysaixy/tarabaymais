import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";
import { invalidateAnalyticsCache } from "./analyticsController";

// ── Input schema ──────────────────────────────────────────────────────────────

const syncUserSchema = z.object({
  firstName: z.string().min(1, "firstName is required"),
  lastName: z.string().min(1, "lastName is required"),
  phone: z.string().min(1, "phone is required"),
  rsbsaNumber: z.string().optional(),
  preferredLanguage: z.string().optional(),
});

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/sync
 *
 * Registers a new user profile in Postgres on first login, or returns the
 * existing profile if the user is already synchronized.
 */
export const syncUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.firebaseUser) {
    throw ApiError.unauthorized("Unauthenticated Firebase session");
  }

  // If DB record already exists (attached by authenticate middleware), return it
  if (req.user) {
    return sendSuccess(res, 200, {
      message: "User already synchronized",
      data: { user: req.user },
    });
  }

  // Validate body for new user creation
  const parseResult = syncUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw ApiError.badRequest(
      "Invalid request body",
      parseResult.error.flatten().fieldErrors,
    );
  }

  const { firstName, lastName, phone, rsbsaNumber, preferredLanguage } =
    parseResult.data;

  // Check if a user with this phone already exists in the database
  const existingUserByPhone = await prisma.user.findFirst({
    where: {
      OR: [
        { phone },
        { phone: phone.replace("+63", "0") },
        { phone: phone.startsWith("0") ? `+63${phone.slice(1)}` : phone },
      ],
    },
    include: { farmerProfile: true },
  });

  if (existingUserByPhone) {
    return sendSuccess(res, 200, {
      message: "User already synchronized",
      data: { user: existingUserByPhone },
    });
  }

  const uid = req.firebaseUser.uid;
  const isTechPhone =
    phone === "+639170000004" ||
    phone === "09170000004" ||
    phone === "+639170000002" ||
    phone === "09170000002";
  const tokenRole = isTechPhone
    ? Role.TECHNICIAN
    : ((req.firebaseUser.role as Role) || Role.FARMER);

  const newUser = await prisma.user.create({
    data: {
      id: uid,
      firstName,
      lastName,
      phone,
      role: tokenRole,
      ...(tokenRole === Role.FARMER
        ? {
            farmerProfile: {
              create: {
                rsbsaNumber: rsbsaNumber ?? null,
                preferredLanguage: preferredLanguage ?? "filipino",
              },
            },
          }
        : {}),
    },
    include: { farmerProfile: true },
  });

  if (tokenRole === Role.FARMER) {
    await invalidateAnalyticsCache();
  }

  return sendSuccess(res, 201, {
    message: "User profile created and synchronized",
    data: { user: newUser },
  });
});

/**
 * GET /api/v1/auth/me
 *
 * Returns the authenticated caller's PostgreSQL profile (including
 * `farmerProfile`). The `authenticate` middleware verifies the Firebase token
 * and attaches the DB record as `req.user` when one exists.
 *
 * - 401 if the Firebase session is missing (handled by middleware), or if the
 *   token is valid but no profile has been synchronized yet (first-time user
 *   must call `POST /api/v1/auth/sync` before `me` returns a profile).
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.firebaseUser) {
    throw ApiError.unauthorized("Unauthenticated Firebase session");
  }

  if (!req.user) {
    throw ApiError.unauthorized(
      "Profile not synchronized. Complete registration first.",
    );
  }

  return sendSuccess(res, 200, {
    message: "Authenticated user profile",
    data: { user: req.user },
  });
});
