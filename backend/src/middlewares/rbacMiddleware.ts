import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { sendError } from "../utils/apiResponse";

/**
 * `authorize` — role-based access control guard.
 *
 * Must be used AFTER `authenticate` so that `req.user` is populated.
 * Returns 401 if the user's DB profile is not yet synchronized with Firebase,
 * and 403 if the user's role is not in the `allowedRoles` list.
 */
export const authorize = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 401, "Unauthorized: User profile not synchronized");
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, 403, "Forbidden: Access restricted for your role");
      return;
    }

    next();
  };
};
