import axios, { AxiosError, AxiosHeaders } from "axios";
import { auth } from "../firebase";

/**
 * Shared Axios instance for all backend calls.
 *
 * - A request interceptor attaches the current Firebase user's ID token as a
 *   Bearer token, since every backend route is guarded by the `authenticate`
 *   middleware which verifies this token.
 * - For `FormData` bodies (file uploads), the JSON content type is removed so
 *   the browser sets `multipart/form-data; boundary=...` itself. Setting it
 *   manually drops the boundary and breaks multer parsing on the backend.
 * - A response interceptor force-refreshes the token and retries once on a
 *   401, and normalizes every error into a stable `ApiError` shape.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Normalized error type ──────────────────────────────────────────────────
/**
 * Every rejected request from this client surfaces as an `ApiError` so pages
 * can read `.message`, `.status`, and field-level `.details` uniformly instead
 * of digging through the raw AxiosError each time.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 for network/offline errors. */
  status: number;
  /** Backend `details` payload (e.g. validation field errors), if any. */
  details?: unknown;
  /** True when the request never reached the server (offline / CORS / DNS). */
  isNetworkError: boolean;

  constructor(
    message: string,
    status: number,
    options?: { details?: unknown; isNetworkError?: boolean },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = options?.details;
    this.isNetworkError = options?.isNetworkError ?? false;
  }
}

interface BackendErrorBody {
  success?: boolean;
  error?: string;
  details?: unknown;
}

function normalizeError(error: AxiosError<BackendErrorBody>): ApiError {
  // No response => network layer failure (offline, CORS, DNS, timeout).
  if (!error.response) {
    return new ApiError("Walang koneksyon sa network. Pakisubukan muli.", 0, {
      isNetworkError: true,
    });
  }

  const { status, data } = error.response;
  const message =
    data?.error || error.message || "May naganap na hindi inaasahang error.";

  return new ApiError(message, status, { details: data?.details });
}

// ── Request interceptor: auth header + multipart handling ────────────────────
api.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    // getIdToken() returns a cached token and refreshes it automatically
    // when it is close to expiring. Wrap in try/catch for offline support.
    try {
      const token = await currentUser.getIdToken();
      config.headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Offline: getIdToken() may fail. Don't attach token - request will fail
      // with proper network error in response interceptor.
      console.warn("[API] Offline: could not get ID token, proceeding without auth header");
    }
  }

  // Let the browser set multipart/form-data (with its boundary) for uploads.
  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  return config;
});

// ── Response interceptor: 401 refresh-and-retry once + error normalization ───
interface RetriableConfig {
  _retried?: boolean;
  headers?: AxiosHeaders;
  [key: string]: unknown;
}

const isOnline = () => typeof navigator !== "undefined" && navigator.onLine;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<BackendErrorBody>) => {
    const original = error.config as
      | (typeof error.config & RetriableConfig)
      | undefined;

    // On a 401, force a fresh ID token and retry the request a single time.
    // Skip force-refresh when offline (getIdToken(true) will fail anyway).
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      auth.currentUser &&
      isOnline()
    ) {
      original._retried = true;
      try {
        const freshToken = await auth.currentUser.getIdToken(true);
        original.headers = AxiosHeaders.from(original.headers);
        (original.headers as AxiosHeaders).set(
          "Authorization",
          `Bearer ${freshToken}`,
        );
        return api.request(original);
      } catch {
        // Fall through to normalized rejection below.
      }
    }

    // If we're offline and got a 401, don't retry - just normalize as network error
    // since the token refresh would fail anyway.
    if (!isOnline() && error.response?.status === 401) {
      return Promise.reject(
        new ApiError("Walang koneksyon sa network. Pakisubukan muli.", 0, {
          isNetworkError: true,
        })
      );
    }

    return Promise.reject(normalizeError(error));
  },
);
