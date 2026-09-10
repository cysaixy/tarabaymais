import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";
import prisma from "../config/prisma";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Missing or invalid token format" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Token value is missing" });
  }

  console.log("Token:", token);

  try {
    const decodedToken = await auth.verifyIdToken(token);
    console.log("DecodedToken", decodedToken);
    req.firebaseUser = decodedToken;

    // Fetch existing user from PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.uid },
      include: { farmerProfile: true },
    });

    if (user) {
      req.user = user;
    }

    return next();
  } catch (error: any) {
    console.error("❌ Firebase Auth Error:", error.code, error.message);
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid Firebase token" });
  }
};
