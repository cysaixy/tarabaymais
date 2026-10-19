import {
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type RecaptchaVerifier,
  type UserCredential,
} from "firebase/auth";
import { auth } from "../firebase";
import { api } from "../lib/api";
import type { DbUserProfile } from "../context/authContext";

/** Fields the backend `/auth/sync` endpoint accepts for a new user. */
export interface RegisterProfilePayload {
  firstName: string;
  lastName: string;
  phone: string;
  rsbsaNumber?: string;
  preferredLanguage?: "filipino" | "ilocano" | "english";
}

/**
 * Normalizes a user-entered PH mobile number to E.164 (`+63XXXXXXXXXX`),
 * which is what Firebase Phone Auth expects.
 *
 * Accepts common local formats: "0917 584 9201", "09175849201",
 * "+639175849201", "639175849201".
 */
export const toE164PH = (input: string): string => {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0")) return `+63${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 10) return `+63${digits}`;
  // Already includes a leading +63 that survived stripping, or unknown shape.
  return input.trim().startsWith("+") ? input.trim() : `+${digits}`;
};

/**
 * Step 1 of phone auth: request an OTP for the given phone number.
 *
 * For Firebase test/synthetic numbers this resolves immediately without
 * sending an SMS or showing a reCAPTCHA challenge, but the verifier must still
 * be supplied.
 *
 * @returns a `ConfirmationResult` whose `.confirm(code)` completes sign-in.
 */
export const sendOtp = (
  phone: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> =>
  signInWithPhoneNumber(auth, toE164PH(phone), verifier);

/**
 * Step 2 of phone auth: confirm the OTP code to finish sign-in.
 * On success the Firebase session is established and `auth.currentUser` is set.
 */
export const confirmOtp = (
  confirmation: ConfirmationResult,
  code: string,
): Promise<UserCredential> => confirmation.confirm(code.trim());

/** Signs the current user out of the Firebase session. */
export const logOut = async (): Promise<void> => {
  await signOut(auth);
};

/**
 * Fetches the authenticated user's backend profile.
 * The Firebase ID token is attached by the axios request interceptor.
 *
 * Throws (401) when the token is valid but no profile has been synced yet —
 * callers should treat that as "needs registration".
 */
export const getMe = async (): Promise<DbUserProfile> => {
  const { data } = await api.get("/auth/me");
  return data.data.user as DbUserProfile;
};

/**
 * Creates the backend/database profile for a newly authenticated Firebase
 * user. The server derives the UID from the verified token, so no `id` is
 * sent in the body. Idempotent: returns the existing profile if already synced.
 */
export const registerProfile = async (
  payload: RegisterProfilePayload,
): Promise<DbUserProfile> => {
  const { data } = await api.post("/auth/sync", payload);
  return data.data.user as DbUserProfile;
};

/**
 * Registers the FCM push notification token with the backend.
 */
export const registerFcmToken = async (fcmToken: string): Promise<void> => {
  await api.post("/register/fcm-token", { fcmToken });
};
