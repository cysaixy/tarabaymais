import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getStorage, Storage } from "firebase-admin/storage";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

// Strict Runtime Validation: Check if production-ready credentials are provided
const hasValidConfig =
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_PROJECT_ID !== "your-firebase-project-id" &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  !process.env.FIREBASE_CLIENT_EMAIL.includes("xxxxx") &&
  !process.env.FIREBASE_CLIENT_EMAIL.toUpperCase().startsWith("PASTE_") &&
  process.env.FIREBASE_CLIENT_EMAIL.endsWith(".iam.gserviceaccount.com") &&
  privateKey &&
  !privateKey.includes("YOUR_PRIVATE_KEY_HERE") &&
  !privateKey.toUpperCase().startsWith("PASTE_") &&
  privateKey.includes("-----BEGIN PRIVATE KEY-----");

let app: App | undefined;
let authInstance: Auth;
let storageInstance: Storage | undefined;

if (hasValidConfig) {
  try {
    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: privateKey!,
        }),
      });
      console.log("🔥 Firebase Admin SDK initialized successfully.");
    } else {
      app = getApps()[0]!;
    }
    authInstance = getAuth(app);
    storageInstance = getStorage(app);
  } catch (err) {
    console.warn("⚠️ Firebase Admin initialization failed, falling back to dev mode:", err);
    authInstance = createDevAuth();
  }
} else {
  console.warn("⚠️ [Firebase Admin] Placeholder credentials detected in .env. Running in development mode with simulated auth.");
  authInstance = createDevAuth();
}

function createDevAuth(): Auth {
  return {
    verifyIdToken: async (token: string) => {
      // In dev mode, attempt to parse client JWT payload if available
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1]!, "base64url").toString("utf-8"),
          );
          if (payload && (payload.sub || payload.user_id || payload.uid)) {
            return {
              uid: payload.sub || payload.user_id || payload.uid,
              role: payload.role || "FARMER",
              phone_number: payload.phone_number || "",
              ...payload,
            } as any;
          }
        }
      } catch {
        // Fallback below
      }
      return {
        uid: token.startsWith("dev-") ? token.replace("dev-", "") : token,
        role: "FARMER",
      } as any;
    },
    setCustomUserClaims: async () => {},
  } as unknown as Auth;
}

// Explicitly type and export the auth instance
export const auth: Auth = authInstance;
export const storage: Storage = storageInstance as Storage;
