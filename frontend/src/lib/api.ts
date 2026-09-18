import axios from "axios";
import { auth } from "../firebase";

/**
 * Shared Axios instance for all backend calls.
 *
 * A request interceptor attaches the current Firebase user's ID token as a
 * Bearer token, since every backend route is guarded by the `authenticate`
 * middleware which verifies this token.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    // getIdToken() returns a cached token and refreshes it automatically
    // when it is close to expiring.
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
