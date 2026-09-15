import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { Role } from "@prisma/client";
import prisma from "../config/prisma";

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
  });
}

export class FcmService {
  /**
   * Send push notification to a specific user by ID.
   */
  static async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });

      if (!user?.fcmToken) return;

      await getMessaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data: data || {},
      });
    } catch (error) {
      console.error(
        `[FCM Error] Failed to send push to user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Send multicast push notification to all active users with a specific role.
   */
  static async sendToRole(
    role: Role,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: { role, fcmToken: { not: null } },
        select: { fcmToken: true },
      });

      const tokens = users.map((u) => u.fcmToken!).filter(Boolean);
      if (tokens.length === 0) return;

      const response = await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data || {},
      });

      console.log(
        `[FCM Multicast] Sent to ${response.successCount} ${role} devices.`,
      );
    } catch (error) {
      console.error(`[FCM Error] Multicast failed for role ${role}:`, error);
    }
  }
}
