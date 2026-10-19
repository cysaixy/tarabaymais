/**
 * useNotifications Hook — Manages notification lifecycle
 * Initializes FCM, registers token, listens for foreground messages
 */

import { useCallback, useEffect, useState } from "react";
import {
  registerForPushNotifications,
  onForegroundMessage,
  isNotificationSupported,
  isPermissionGranted,
  shouldPromptForPermission,
  markPrompted,
  unregisterPushNotifications,
} from "../services/notification.service";
import { useAuth } from "../context/authContext";
import { registerFcmToken } from "../services/auth.service";
import { toast } from "sonner";

interface UseNotificationsOptions {
  /** Auto-register token on mount (default: true) */
  autoRegister?: boolean;
  /** Show toast when new notification arrives in foreground */
  showForegroundToast?: boolean;
}

export function useNotifications({
  autoRegister = true,
  showForegroundToast = true,
}: UseNotificationsOptions = {}) {
  const { profile } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    typeof window !== "undefined" ? Notification.permission : "default",
  );
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  // Update permission status
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Register FCM token with backend
  const registerToken = useCallback(async () => {
    if (!isNotificationSupported()) return;
    if (!profile?.id) return;

    setIsInitializing(true);
    try {
      const token = await registerForPushNotifications(async (token) => {
        await registerFcmToken(token);
      });
      if (token) setFcmToken(token);
    } catch (e) {
      console.error("[useNotifications] Token registration failed:", e);
    } finally {
      setIsInitializing(false);
    }
  }, [profile?.id]);

  // Auto-register on mount/profile change
  useEffect(() => {
    if (autoRegister && profile?.id && isPermissionGranted()) {
      // Check if already registered
      const registered = localStorage.getItem("fcm_token_registered");
      if (!registered || localStorage.getItem("fcm_token") === null) {
        registerToken();
      }
    }
  }, [autoRegister, profile?.id, registerToken]);

  // Listen for foreground messages
  useEffect(() => {
    if (!showForegroundToast) return;

    let unsubscribe: (() => void) | null = null;
    const setup = async () => {
      unsubscribe = onForegroundMessage((payload) => {
        const notification = payload.notification;
        if (notification?.title && notification?.body) {
          toast.info(notification.title, {
            description: notification.body,
            duration: 5000,
            action: {
              label: "Buksan",
              onClick: () => {
                const data = payload.data || {};
                if (data.type === "KONSULTASYON" && data.caseId) {
                  window.location.href = `/farmer/expert-request?case=${data.caseId}`;
                } else if (data.type === "DISASTER" && data.caseId) {
                  window.location.href = `/farmer/history/disasters?case=${data.caseId}`;
                }
              },
            },
          });
        }
      });
    };
    setup();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showForegroundToast]);

  // Prompt for permission if needed (delayed to not interrupt UX)
  useEffect(() => {
    if (autoRegister && profile?.id && shouldPromptForPermission()) {
      const timer = setTimeout(() => {
        setShowPermissionPrompt(true);
      }, 10000); // 10 seconds after load

      return () => clearTimeout(timer);
    }
  }, [autoRegister, profile?.id]);

  const requestPermissionAndRegister = useCallback(async () => {
    markPrompted();
    setShowPermissionPrompt(false);
    await registerToken();
  }, [registerToken]);

  const dismissPermissionPrompt = useCallback(() => {
    markPrompted();
    setShowPermissionPrompt(false);
  }, []);

  const logout = useCallback(async () => {
    await unregisterPushNotifications();
    setFcmToken(null);
  }, []);

  return {
    // State
    isSupported: isNotificationSupported(),
    permissionStatus,
    fcmToken,
    isInitializing,
    showPermissionPrompt,
    isPermissionGranted: isPermissionGranted(),

    // Actions
    requestPermissionAndRegister,
    dismissPermissionPrompt,
    registerToken,
    logout,
  };
}