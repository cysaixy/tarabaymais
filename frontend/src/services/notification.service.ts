/**
 * Notification Service — FCM Push Notifications & In-App Notifications
 * Handles permission, token registration, foreground/background messages
 */

import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { firebaseConfig } from "../firebase";

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

/** Initialize Firebase Messaging (call once on app startup) */
export function initMessaging(): ReturnType<typeof getMessaging> | null {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) {
    console.warn("[Notifications] Service Worker not supported");
    return null;
  }

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (e) {
    console.error("[Notifications] Failed to init messaging:", e);
    return null;
  }
}

/** Get the messaging instance (initializes if needed) */
export function getMessagingInstance(): ReturnType<typeof getMessaging> | null {
  return messagingInstance ?? initMessaging();
}

/** Request notification permission and register FCM token with backend */
export async function registerForPushNotifications(
  apiRegisterFn: (token: string) => Promise<void>,
): Promise<string | null> {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[Notifications] Permission denied");
      return null;
    }

    // Get FCM token (requires vapidKey in production)
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey: vapidKey || undefined });

    if (!token) {
      console.warn("[Notifications] No FCM token received");
      return null;
    }

    // Register with backend
    await apiRegisterFn(token);

    // Store locally for quick access
    localStorage.setItem("fcm_token", token);
    localStorage.setItem("fcm_token_registered", "true");

    console.log("[Notifications] FCM token registered:", token.slice(0, 20) + "...");
    return token;
  } catch (e) {
    console.error("[Notifications] Registration failed:", e);
    return null;
  }
}

/** Listen for foreground messages */
export function onForegroundMessage(
  handler: (payload: MessagePayload) => void,
): (() => void) | null {
  const messaging = getMessagingInstance();
  if (!messaging) return null;

  return onMessage(messaging, (payload) => {
    console.log("[Notifications] Foreground message:", payload);
    handler(payload);
  });
}

/** Check if notifications are supported and permission granted */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function isPermissionGranted(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === "granted";
}

/** Unregister FCM token (on logout) */
export async function unregisterPushNotifications(
  apiUnregisterFn?: () => Promise<void>,
): Promise<void> {
  try {
    if (apiUnregisterFn) await apiUnregisterFn();
  } catch (e) {
    console.warn("[Notifications] Backend unregister failed:", e);
  }

  localStorage.removeItem("fcm_token");
  localStorage.removeItem("fcm_token_registered");

  const messaging = getMessagingInstance();
  if (messaging) {
    // Note: Firebase doesn't provide a direct token deletion API from client
    // Token will be invalidated on backend when it fails
  }
}

/** Check if we should prompt for notification permission */
export function shouldPromptForPermission(): boolean {
  if (!isNotificationSupported()) return false;
  if (isPermissionGranted()) return false;
  if (Notification.permission === "denied") return false;

  // Check if we've already prompted recently (24h)
  const lastPrompt = localStorage.getItem("notification_prompted_at");
  if (lastPrompt) {
    const hoursSince = (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60);
    if (hoursSince < 24) return false;
  }
  return true;
}

/** Mark that we've prompted for permission */
export function markPrompted(): void {
  localStorage.setItem("notification_prompted_at", String(Date.now()));
}