import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";
import prisma from "../config/prisma";
import { sendError } from "../utils/apiResponse";

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

    // Attach DB user record if one exists for this UID or verified phone number
    const phone = decodedToken.phone_number;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: decodedToken.uid },
          ...(phone
            ? [
                { phone },
                { phone: phone.replace("+63", "0") },
                { phone: phone.replace("+63", "") },
              ]
            : []),
        ],
      },
      include: { farmerProfile: true },
    });

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
