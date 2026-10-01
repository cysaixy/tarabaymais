import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

/**
 * Application role. Matches the backend Prisma `Role` enum / Firebase token
 * custom claim exactly (uppercase). The backend is the single source of truth.
 */
export type UserRole = "FARMER" | "TECHNICIAN" | "OFFICER";

/**
 * Normalizes a raw role value (from a token claim or the `/auth/me` payload)
 * to a known {@link UserRole}. Unknown or missing values default to `FARMER`,
 * which is also the backend default for freshly synced users.
 */
export const toUserRole = (raw: unknown): UserRole => {
  if (raw === "TECHNICIAN" || raw === "technician") return "TECHNICIAN";
  if (raw === "OFFICER" || raw === "officer") return "OFFICER";
  return "FARMER";
};

/** True for roles that use the municipal (officer/technician) portal. */
export const isMunicipalRole = (role: UserRole | null): boolean =>
  role === "TECHNICIAN" || role === "OFFICER";

/** User profile as returned by the backend `/auth/me` and `/auth/sync`. */
export interface DbUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  farmerProfile?: {
    rsbsaNumber: string | null;
    preferredLanguage: string;
  } | null;
}

export interface AuthContextType {
  /** The raw Firebase user, or null when signed out. */
  user: User | null;
  /** The backend DB profile, or null when not yet synced / signed out. */
  profile: DbUserProfile | null;
  /** The resolved role, or null when signed out / unresolved. */
  role: UserRole | null;
  /** True while the initial session / profile resolution is in flight. */
  loading: boolean;
  /** Signs out of Firebase and clears local session state. */
  logout: () => Promise<void>;
  /**
   * Re-fetches the backend profile for the current Firebase user and updates
   * context. Call this after completing registration (`/auth/sync`) so guards
   * see the freshly created profile without a full page reload.
   */
  refreshProfile: () => Promise<DbUserProfile | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error(
      "useAuth must be called from inside an active AuthProvider context shell.",
    );
  }
  return context;
};
