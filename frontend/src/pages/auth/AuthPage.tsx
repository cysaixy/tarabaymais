import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../../firebase";
import type { UserRole } from "../../context/authContext";

const ROLE_STORAGE_KEY = "tm.role";

/**
 * Sample login screen.
 *
 * For scaffolding purposes this signs in anonymously through Firebase and
 * persists the chosen role locally so the ProtectedRoute guard can resolve it.
 * Swap the anonymous sign-in for real email/password (or provider) auth and
 * drive the role from backend-issued custom claims when the API is ready.
 */
const AuthPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enterAs = async (role: UserRole) => {
    setSubmitting(role);
    setError(null);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
      await signInAnonymously(auth);
      navigate(role === "technician" ? "/technician" : "/farmer", {
        replace: true,
      });
    } catch (err) {
      console.error("Sign-in failed:", err);
      localStorage.removeItem(ROLE_STORAGE_KEY);
      setError(
        "Sign-in failed. Ensure Anonymous auth is enabled in your Firebase project.",
      );
      setSubmitting(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Welcome to TarabayMais</h1>
          <p className="mt-1 text-sm text-slate-400">
            Choose how you want to sign in for this demo.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => enterAs("farmer")}
            disabled={submitting !== null}
            className="w-full rounded-lg bg-teal-500 px-4 py-3 font-medium text-slate-950 transition hover:bg-teal-400 disabled:opacity-60"
          >
            {submitting === "farmer" ? "Signing in..." : "Continue as Farmer"}
          </button>
          <button
            onClick={() => enterAs("technician")}
            disabled={submitting !== null}
            className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
          >
            {submitting === "technician"
              ? "Signing in..."
              : "Continue as Technician"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
