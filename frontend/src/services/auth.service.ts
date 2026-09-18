import { signOut } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Signs the current user out of the Firebase session.
 */
export const logOut = async (): Promise<void> => {
  await signOut(auth);
};
