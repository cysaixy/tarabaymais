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

  // Helper to establish session (works both with real user and demo/offline)
  const setSessionData = (
    userRole: UserRole,
    customProfile?: Partial<DbUserProfile>,
  ) => {
    setRole(userRole);
    if (userRole === "farmer") {
      setProfile({
        id: customProfile?.id || "farmer-juan-01",
        firstName: customProfile?.firstName || "Mang Juan",
        lastName: customProfile?.lastName || "Dela Cruz",
        phone: customProfile?.phone || "0917 584 9201",
        role: "FARMER",
        farmerProfile: {
          rsbsaNumber: "02-31-04-001-000456",
          preferredLanguage: "filipino",
        },
      });
      setUser({
        uid: "farmer-juan-01",
        email: "juan.delacruz@tarabay.ph",
        displayName: "Mang Juan Dela Cruz",
      } as unknown as User);
    } else {
      setProfile({
        id: "tech-maria-02",
        firstName: "Engr. Maria",
        lastName: "Santos",
        phone: "0918-987-6543",
        role: "TECHNICIAN",
      });
      setUser({
        uid: "tech-maria-02",
        email: "maria.santos@da.region2.gov.ph",
        displayName: "Engr. Maria Santos (DA Region II)",
      } as unknown as User);
    }
    localStorage.setItem("tarabay_session_role", userRole);
    setLoading(false);
  };

  useEffect(() => {
    // Check if session role is saved in localStorage
    const savedRole = localStorage.getItem(
      "tarabay_session_role",
    ) as UserRole | null;
    if (savedRole) {
      setSessionData(savedRole);
      return;
    }

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

  const loginAsDemo = (selectedRole: UserRole) => {
    setSessionData(selectedRole);
  };

  const loginWithPhonePin = async (
    phone: string,
    pin: string,
  ): Promise<boolean> => {
    // Validate phone and 4-digit PIN
    const cleanedPhone = phone.replace(/\D/g, "");
    const cleanedPin = pin.trim();

    if (cleanedPhone.length < 10 || cleanedPin.length !== 4) {
      return false;
    }

    // Set farmer session
    setSessionData("farmer", { phone: phone.trim() });
    return true;
  };

  const logout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("tarabay_session_role");
      try {
        await logOut();
      } catch {
        // Safe to ignore in offline/demo mode
      }
      setUser(null);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        logout,
        loginAsDemo,
        loginWithPhonePin,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
