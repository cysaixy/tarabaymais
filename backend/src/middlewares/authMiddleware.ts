import { Request, Response, NextFunction } from "express";
import { Prisma, Role } from "@prisma/client";
import { auth } from "../config/firebase";
import prisma from "../config/prisma";
import { sendError } from "../utils/apiResponse";
import {
  isDesignatedFarmerPhone,
  normalizePhilippinePhone,
} from "../utils/phone";

const TECHNICIAN_NUMBERS = new Set([
  "+639170000004",
  "09170000004",
  "639170000004",
]);

/**
 * `authenticate` — verifies the Firebase Bearer token in every incoming request.
 *
 * On success:
 *   - Attaches the decoded Firebase token to `req.firebaseUser`
 *   - If the UID already has a DB record, attaches it to `req.user`
 *
 * On failure:
 *   - Returns 401 immediately; the request does NOT proceed further.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, 401, "Unauthorized: Missing or invalid token format");
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    sendError(res, 401, "Unauthorized: Token value is missing");
    return;
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.firebaseUser = decodedToken;

    // Always prefer the Firebase UID. Phone-number fallback is only for legacy
    // records created before Firebase UIDs were persisted as the user ID.
    const phone = decodedToken.phone_number;
    let user = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
      include: { farmerProfile: true },
    });

    if (!user && phone) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { phone },
            { phone: phone.replace("+63", "0") },
            { phone: phone.replace("+63", "") },
          ],
        },
        include: { farmerProfile: true },
      });
    }

    const normalizedPhone = phone ? normalizePhilippinePhone(phone) : null;

    // These Firebase test accounts are farmer registrations, not technician accounts.
    if (user && isDesignatedFarmerPhone(phone) && user.role === Role.FARMER) {
      if (user.role !== Role.FARMER) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: Role.FARMER },
          include: { farmerProfile: true },
        });
      }

      if (decodedToken.role !== "farmer") {
        auth
          .setCustomUserClaims(decodedToken.uid, { role: "farmer" })
          .catch((error: unknown) => {
            console.warn("[Auth] Could not update farmer role claim:", error);
          });
      }
    }

    // Auto-provision or promote the designated technician account.
    if (normalizedPhone && TECHNICIAN_NUMBERS.has(normalizedPhone)) {
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: decodedToken.uid,
            firstName: "DA Field",
            lastName: "Technician",
            phone: normalizedPhone,
            role: Role.TECHNICIAN,
          },
          include: { farmerProfile: true },
        });
      } else if (user.role !== Role.TECHNICIAN) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: Role.TECHNICIAN },
          include: { farmerProfile: true },
        });
      }

      // Sync custom claims to Firebase token in background
      auth
        .setCustomUserClaims(decodedToken.uid, { role: "technician" })
        .catch((error: unknown) => {
          console.warn("[Auth] Could not update technician role claim:", error);
        });
    }

    if (
      user?.role === Role.FARMER &&
      normalizedPhone &&
      normalizePhilippinePhone(user.phone) !== normalizedPhone
    ) {
      const localPhone = normalizedPhone.replace(/^\+63/, "0");
      const phoneWithoutPlus = normalizedPhone.replace(/^\+/, "");
      const phoneOwner = await prisma.user.findFirst({
        where: {
          id: { not: user.id },
          OR: [
            { phone: normalizedPhone },
            { phone: localPhone },
            { phone: phoneWithoutPlus },
          ],
        },
        select: { id: true },
      });

      if (phoneOwner) {
        console.warn(
          "[Auth] Could not sync verified farmer phone because it belongs to another account.",
        );
      } else {
        try {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { phone: normalizedPhone },
            include: { farmerProfile: true },
          });
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            console.warn(
              "[Auth] Could not sync verified farmer phone because it was assigned to another account.",
            );
          } else {
            throw error;
          }
        }
      }
    }

    if (user) {
      req.user = user;
    }

    next();
  } catch (error: unknown) {
    const code = (error as Record<string, unknown>)?.code ?? "UNKNOWN";
    const message = (error as Record<string, unknown>)?.message ?? "";
    console.error(`[Auth] Firebase token verification failed — ${code}: ${message}`);
    sendError(res, 401, "Unauthorized: Invalid or expired Firebase token");
  }
};
