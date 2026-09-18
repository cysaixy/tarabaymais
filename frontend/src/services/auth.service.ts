import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { auth } from "../firebase";
import { api } from "../lib/api";
import type { DbUserProfile } from "../context/authContext";

/** Fields required by the backend `/auth/sync` endpoint for a new user. */
export interface SyncUserPayload {
  firstName: string;
  lastName: string;
  phone: string;
  rsbsaNumber?: string;
  preferredLanguage?: string;
}

/** Creates a Firebase account with email + password. */
export const signUp = (
  email: string,
  password: string,
): Promise<UserCredential> =>
  createUserWithEmailAndPassword(auth, email, password);

/** Signs an existing user in with email + password. */
export const logIn = (
  email: string,
  password: string,
): Promise<UserCredential> =>
  signInWithEmailAndPassword(auth, email, password);

/** Signs the current user out of the Firebase session. */
export const logOut = async (): Promise<void> => {
  await signOut(auth);
};

/**
 * Synchronizes the authenticated user with the backend/database.
 *
 * The endpoint is idempotent: it creates the profile on first call and returns
 * the existing profile on subsequent calls. The Firebase token is attached by
 * the axios request interceptor.
 *
 * @param payload Required only when creating a new profile. On login the body
 *                is ignored by the backend if the user already exists.
 */
export const syncUser = async (
  payload?: SyncUserPayload,
): Promise<DbUserProfile> => {
  const { data } = await api.post("/auth/sync", payload ?? {});
  return data.data.user as DbUserProfile;
};
