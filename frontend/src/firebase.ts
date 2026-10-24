import { initializeApp } from "firebase/app";
import {
  getAuth,
  indexedDBLocalPersistence,
  setPersistence,
  RecaptchaVerifier,
} from "firebase/auth";

// Build the configuration object pulling from Vite's secure env layer
export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyDemoFallbackKeyForLocalDevelopment123",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "tarabay-mais-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tarabay-mais-demo",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "tarabay-mais-demo.appspot.com",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:123456789012:web:abcdef1234567890",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

/**
 * Auth instance with IndexedDB persistence explicitly set.
 *
 * Firebase's default in a browser PWA is already browserLocalPersistence
 * (IndexedDB-backed), but we set this explicitly to:
 *   1. Make the offline-first intent unmistakably clear.
 *   2. Guard against accidental regression if someone imports inMemoryPersistence.
 *
 * IndexedDB survives full app close, device reboot, and service-worker clears,
 * so the farmer never has to log in again unless they explicitly sign out.
 */
export const auth = getAuth(app);

// Upgrade persistence to IndexedDB (the PWA standard). We call this
// immediately after getAuth so it is settled before any auth listener fires.
// The promise is intentionally fire-and-forget here: if the browser does not
// support IndexedDB the SDK falls back to localStorage gracefully.
void setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
  console.warn(
    "[Firebase] Could not set IndexedDB persistence. Falling back to default:",
    err,
  );
});

/**
 * Creates (or reuses) an invisible reCAPTCHA verifier bound to a DOM element.
 *
 * Firebase Phone Auth requires a `RecaptchaVerifier` even for test/synthetic
 * numbers — the SDK short-circuits the actual challenge for whitelisted test
 * numbers, but the verifier object must still be passed to
 * `signInWithPhoneNumber`.
 *
 * The verifier is cached on `window` so repeated sends (e.g. "Resend code")
 * do not stack multiple widgets, which Firebase rejects.
 *
 * @param containerId The id of an (empty) DOM element to anchor the widget.
 */
export const getRecaptchaVerifier = (
  containerId = "recaptcha-container",
): RecaptchaVerifier => {
  const w = window as typeof window & {
    __tarabayRecaptcha?: RecaptchaVerifier;
  };

  if (!w.__tarabayRecaptcha) {
    w.__tarabayRecaptcha = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
    });
  }

  return w.__tarabayRecaptcha;
};

/**
 * Tears down the cached reCAPTCHA verifier. Call this after a successful
 * confirmation (or on unmount) so the next auth attempt starts clean.
 */
export const clearRecaptchaVerifier = (): void => {
  const w = window as typeof window & {
    __tarabayRecaptcha?: RecaptchaVerifier;
  };
  if (w.__tarabayRecaptcha) {
    w.__tarabayRecaptcha.clear();
    w.__tarabayRecaptcha = undefined;
  }
};
