import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/ApiError";
import { z } from "zod";
import { invalidateAnalyticsCache } from "./analyticsController";
import { isDesignatedFarmerPhone } from "../utils/phone";

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

  const isFarmerRegistration = isDesignatedFarmerPhone(
    req.firebaseUser.phone_number,
  );

  // For non-designated phones: only skip re-registration if the user already
  // has a complete profile (farmerProfile present for FARMER role, or any
  // non-FARMER role which doesn't need a farmerProfile).
  if (req.user && !isFarmerRegistration) {
    const needsFarmerProfile =
      req.user.role === Role.FARMER && !req.user.farmerProfile;

    if (!needsFarmerProfile) {
      return sendSuccess(res, 200, {
        message: "User already synchronized",
        data: { user: req.user },
      });
    }
    // Fall through to complete the missing farmerProfile below.
  }

  if (req.user && isFarmerRegistration) {
    const existingProfile = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { farmerProfile: true },
    });

    if (
      existingProfile?.role === Role.FARMER &&
      existingProfile.farmerProfile
    ) {
      return sendSuccess(res, 200, {
        message: "User already synchronized",
        data: { user: existingProfile },
      });
    }
  }

  // Validate body for new user creation or incomplete farmer registration.
  const parseResult = syncUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw ApiError.badRequest(
      "Invalid request body",
      parseResult.error.flatten().fieldErrors,
    );
  }

  const { firstName, lastName, phone, rsbsaNumber, preferredLanguage } =
    parseResult.data;

  // If the middleware already found this user (by UID or phone) but they're a
  // FARMER without a farmerProfile, complete the registration now.
  if (req.user && req.user.role === Role.FARMER && !req.user.farmerProfile) {
    const completedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        firstName,
        lastName,
        farmerProfile: {
          upsert: {
            create: {
              rsbsaNumber: rsbsaNumber ?? null,
              preferredLanguage: preferredLanguage ?? "filipino",
            },
            update: {
              ...(rsbsaNumber !== undefined ? { rsbsaNumber } : {}),
              ...(preferredLanguage !== undefined ? { preferredLanguage } : {}),
            },
          },
        },
      },
      include: { farmerProfile: true },
    });
    await invalidateAnalyticsCache();

    return sendSuccess(res, 200, {
      message: "Farmer profile completed and synchronized",
      data: { user: completedUser },
    });
  }

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
    if (
      (isFarmerRegistration || existingUserByPhone.role === Role.FARMER) &&
      (existingUserByPhone.role !== Role.FARMER ||
        !existingUserByPhone.farmerProfile)
    ) {
      const farmerUser = await prisma.user.update({
        where: { id: existingUserByPhone.id },
        data: {
          firstName,
          lastName,
          phone,
          role: Role.FARMER,
          farmerProfile: {
            upsert: {
              create: {
                rsbsaNumber: rsbsaNumber ?? null,
                preferredLanguage: preferredLanguage ?? "filipino",
              },
              update: {
                ...(rsbsaNumber !== undefined ? { rsbsaNumber } : {}),
                ...(preferredLanguage !== undefined
                  ? { preferredLanguage }
                  : {}),
              },
            },
          },
        },
        include: { farmerProfile: true },
      });
      await invalidateAnalyticsCache();

      return sendSuccess(res, 200, {
        message: "Farmer profile created and synchronized",
        data: { user: farmerUser },
      });
    }

    return sendSuccess(res, 200, {
      message: "User already synchronized",
      data: { user: existingUserByPhone },
    });
  }

  const uid = req.firebaseUser.uid;
  const isTechPhone =
    phone === "+639170000004" ||
    phone === "09170000004";
  const tokenRole = isFarmerRegistration
    ? Role.FARMER
    : isTechPhone
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
