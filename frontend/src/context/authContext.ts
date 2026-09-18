import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

export type UserRole = "farmer" | "technician";

export interface AuthUserTemplate {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
}

export interface AuthContextType {
  user: User | null;
  profile: AuthUserTemplate | null;
  role: UserRole | null;
  loading: boolean;
  logout: () => Promise<void>;
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
