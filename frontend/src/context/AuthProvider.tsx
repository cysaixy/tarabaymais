import React, { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../firebase";
import {
  AuthContext,
  toUserRole,
  type DbUserProfile,
  type UserRole,
} from "./authContext";
import { logOut, syncUser } from "../services/auth.service";

/**
 * Reads the role from the Firebase ID token's custom claim.
 * The backend sets this claim; it is the single source of truth for role.
 */
const readRoleFromToken = async (currentUser: User): Promise<UserRole> => {
  const tokenResult = await currentUser.getIdTokenResult();
  return toUserRole(tokenResult.claims.role);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setRole(await readRoleFromToken(currentUser));

      // Hydrate the DB profile. A bodyless sync returns the existing profile
      // for known users. For a brand-new signup the profile may not exist yet
      // (the signup flow creates it with the required fields), so a failure
      // here is non-fatal.
      try {
        const dbProfile = await syncUser();
        setProfile(dbProfile);
      } catch {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await logOut();
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
