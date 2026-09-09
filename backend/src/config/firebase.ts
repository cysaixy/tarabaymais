import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

// Strict Runtime Validation: Fail fast on startup if environment keys are missing
if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !privateKey
) {
  throw new Error(
    "❌ Critical Configuration Error: Missing Firebase Admin environment variables in .env",
  );
}

let app: App;

// HMR/Reload Guard: Re-use the existing instance if ts-node-dev reloads the server
if (getApps().length === 0) {
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
  console.log("🔥 Firebase Admin SDK initialized successfully.");
} else {
  // Use the default instance already running
  app = getApps()[0]!;
}

// Explicitly type and export the auth instance
export const auth: Auth = getAuth(app);
