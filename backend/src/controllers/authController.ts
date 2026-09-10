import { Request, Response } from "express";
import prisma from "../config/prisma";
import { Role } from "@prisma/client";
import { create } from "node:domain";

interface SyncRequestBody {
  firstName: string;
  lastName: string;
  phone: string;
  rsbsaNumber?: string;
  preferredLanguage?: string;
}

export const syncUser = async (req: Request, res: Response) => {
  if (!req.firebaseUser) {
    return res.status(401).json({ error: "Unauthenticated Firebase session" });
  }

  if (req.user) {
    return res.status(200).json({
      message: "User synchronized successfully",
      user: req.user,
    });
  }

  const uid = req.firebaseUser.uid;
  const tokenRole = (req.firebaseUser.role as Role) || Role.FARMER;
  const { firstName, lastName, phone, rsbsaNumber, preferredLanguage } =
    req.body as SyncRequestBody;

  try {
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
                  rsbsaNumber: rsbsaNumber || null,
                  preferredLanguage: preferredLanguage || "filipino",
                },
              },
            }
          : {}),
      },
      include: { farmerProfile: true },
    });

    return res.status(201).json({
      message: "User profile created and synchronized",
      user: newUser,
    });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: "Failed to sync user", details: error.message });
  }
};
