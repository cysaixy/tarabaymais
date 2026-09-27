import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

/** Frontend role (lowercase). Backend token claims are uppercase FARMER/TECHNICIAN. */
export type UserRole = "farmer" | "technician";

/** Raw role value as stored in the Firebase token claim / Postgres. */
export type BackendRole = "FARMER" | "TECHNICIAN";

/** Maps a backend/token role to the frontend role. Defaults to farmer. */
export const toUserRole = (raw: unknown): UserRole =>
  raw === "TECHNICIAN" || raw === "technician" ? "technician" : "farmer";

/** User profile as returned by the backend `/auth/sync` endpoint. */
export interface DbUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: BackendRole;
  farmerProfile?: {
    rsbsaNumber: string | null;
    preferredLanguage: string;
  } | null;
}

export interface AuthContextType {
  user: User | null;
  profile: DbUserProfile | null;
  role: UserRole | null;
  loading: boolean;
  logout: () => Promise<void>;
  loginAsDemo?: (role: UserRole) => void;
  loginWithPhonePin?: (phone: string, pin: string) => Promise<boolean>;
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
