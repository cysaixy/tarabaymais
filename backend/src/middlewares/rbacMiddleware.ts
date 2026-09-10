import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

export const authorize = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User profile not synchronized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Access restricted for your role" });
    }

    return next();
  };
};
