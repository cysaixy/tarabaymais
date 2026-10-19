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

// Export the initialized authentication reference
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
