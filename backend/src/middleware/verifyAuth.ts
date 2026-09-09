import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";
import { DecodedIdToken } from "firebase-admin/auth";

// Extend the official DecodedIdToken type
export interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken & {
    role: string;
  };
}

export async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No authorization token provided.",
    });
  }

  const token = authHeader.split("Bearer ")[1]?.trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Malformed token format.",
    });
  }

  try {
    // Second argument `true` enforces checking token revocation status
    const decodedToken = await auth.verifyIdToken(token, true);

    (req as AuthenticatedRequest).user = {
      ...decodedToken,
      role: (decodedToken.role as string) || "customer",
    };

    return next();
  } catch (err: any) {
    console.error("Auth verification error:", err.code || err.message);

    if (err.code === "auth/id-token-revoked") {
      return res.status(401).json({
        success: false,
        message: "Token has been revoked. Please log in again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authorization token.",
    });
  }
}
