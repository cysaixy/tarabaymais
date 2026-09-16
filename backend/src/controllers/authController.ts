import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";

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

  const uid = req.firebaseUser.uid;
  const tokenRole = (req.firebaseUser.role as Role) || Role.FARMER;

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

  return sendSuccess(res, 201, {
    message: "User profile created and synchronized",
    data: { user: newUser },
  });
});
