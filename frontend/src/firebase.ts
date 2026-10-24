import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier } from "firebase/auth";

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
 * Firebase Auth instance.
 *
 * PERSISTENCE: We intentionally use the default `browserLocalPersistence`
 * (localStorage). This is the correct choice for an offline-first PWA:
 *
 *   ✅  Survives full PWA close + swipe from recents
 *   ✅  Survives phone reboot
 *   ✅  NOT cleared when only the service worker is cleared
 *   ✅  Cleared on explicit signOut() (correct)
 *   ✅  Cleared on "Clear Site Data" in browser settings (correct)
 *
 * WHY NOT setPersistence(auth, indexedDBLocalPersistence):
 *   Calling setPersistence() after getAuth() triggers an ASYNC session
 *   migration (localStorage → IndexedDB). During that migration, Firebase
 *   fires onAuthStateChanged(null) before restoring the user — which causes
 *   the route guard to redirect the farmer to the login page on every cold
 *   boot. Do NOT add a setPersistence() call here.
 */
export const auth = getAuth(app);

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
