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
    let fcmToken: string | null = null;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true },
      });

      fcmToken = user?.fcmToken ?? null;

      if (!fcmToken) return;

      await getMessaging().send({
        token: fcmToken,
        notification: { title, body },
        data: data || {},
      });
    } catch (error: any) {
      console.error(
        `[FCM Error] Failed to send push to user ${userId}:`,
        error,
      );

      const errorCode = error?.code;

      if (
        fcmToken &&
        (errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token")
      ) {
        await prisma.user.updateMany({
          where: {
            id: userId,
            fcmToken,
          },
          data: { fcmToken: null },
        });

        console.log(`Removed invalid FCM token for user ${userId}.`);
      }
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
        `[FCM Multicast] Success: ${response.successCount}, Failed: ${response.failureCount}`,
      );

      for (const [index, result] of response.responses.entries()) {
        if (!result.success) {
          const token = tokens[index];

          console.error(`Token ${index} failed:`, result.error);

          if (
            token &&
            (result.error?.code ===
              "messaging/registration-token-not-registered" ||
              result.error?.code === "messaging/invalid-registration-token")
          ) {
            await prisma.user.updateMany({
              where: { fcmToken: token },
              data: { fcmToken: null },
            });
          }
        }
      }
    } catch (error) {
      console.error(`[FCM Error] Multicast failed for role ${role}:`, error);
    }
  }
}
