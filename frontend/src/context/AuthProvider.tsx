import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import {
  AuthContext,
  type AuthUserTemplate,
  type UserRole,
} from "./authContext";
import { logOut } from "../services/auth.service";

const ROLE_STORAGE_KEY = "tm.role";

/**
 * Resolves the active role for a user.
 *
 * Primary source is the Firebase custom claim `role`. When no claim is present
 * (e.g. during local sample/testing before the backend sets claims), it falls
 * back to a locally persisted role chosen at login.
 */
const resolveRole = async (currentUser: User): Promise<UserRole | null> => {
  try {
    const tokenResult = await currentUser.getIdTokenResult();
    const claimRole = tokenResult.claims.role as UserRole | undefined;
    if (claimRole === "farmer" || claimRole === "technician") {
      return claimRole;
    }
  } catch (error) {
    console.error("Error reading Firebase custom token claims:", error);
  }

  const stored = localStorage.getItem(ROLE_STORAGE_KEY);
  if (stored === "farmer" || stored === "technician") {
    return stored;
  }
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthUserTemplate | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        setProfile({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          phoneNumber: currentUser.phoneNumber,
          photoURL: currentUser.photoURL,
        });
        setRole(await resolveRole(currentUser));
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await logOut();
      localStorage.removeItem(ROLE_STORAGE_KEY);
      setUser(null);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
