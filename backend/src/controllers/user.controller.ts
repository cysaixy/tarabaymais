import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import prisma from "../config/prisma";

export const registerFcmToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      res.status(400).json({ error: "FCM token is required" });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });

    res.status(200).json({ message: "FCM token updated successfully" });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Failed to update FCM token", details: error.message });
  }
};
