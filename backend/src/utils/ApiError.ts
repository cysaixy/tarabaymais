/**
 * ApiError — a structured, throwable HTTP error.
 *
 * Throw this anywhere inside an `asyncHandler`-wrapped controller or service.
 * The centralized error middleware (`error.middleware.ts`) will catch it and
 * convert it into a standardized JSON error response automatically.
 *
 * Usage:
 *   throw ApiError.notFound("Farm not found");
 *   throw ApiError.badRequest("areaHectares must be a positive number");
 *   throw new ApiError(422, "Custom message", { field: "details" });
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;

    // Maintain proper prototype chain in transpiled ES5+
    Object.setPrototypeOf(this, new.target.prototype);
  }

  // ── Static factory helpers ─────────────────────────────────────────────

  /** 400 — Malformed request body or invalid query parameters. */
  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  /** 401 — Missing or invalid authentication credentials. */
  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(401, message);
  }

  /** 403 — Authenticated but lacking the required role/permission. */
  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }

  /** 404 — Requested resource does not exist. */
  static notFound(message: string): ApiError {
    return new ApiError(404, message);
  }

  /** 500 — Unexpected internal server error. */
  static internal(message = "Internal server error"): ApiError {
    return new ApiError(500, message);
  }
}
