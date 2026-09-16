import { Response } from "express";

/**
 * Standard success/error response helpers.
 *
 * Enforces a single API contract across every controller:
 *   Success: { success: true, data?: ..., message?: ... }
 *   Error:   { success: false, error: "message", details?: ... }
 */

interface SuccessOptions<T> {
  data?: T;
  message?: string;
}

/**
 * Send a standardized success response.
 *
 * @param res        Express response object
 * @param statusCode HTTP status (200 for reads/updates, 201 for creates)
 * @param options    Optional `data` payload and/or human-readable `message`
 */
export function sendSuccess<T>(
  res: Response,
  statusCode = 200,
  options: SuccessOptions<T> = {},
): Response {
  const body: Record<string, unknown> = { success: true };

  if (options.data !== undefined) body.data = options.data;
  if (options.message !== undefined) body.message = options.message;

  return res.status(statusCode).json(body);
}

/**
 * Send a standardized error response. Primarily used by the centralized error
 * middleware; controllers should prefer throwing `ApiError`.
 */
export function sendError(
  res: Response,
  statusCode: number,
  error: string,
  details?: unknown,
): Response {
  const body: Record<string, unknown> = { success: false, error };

  if (details !== undefined) body.details = details;

  return res.status(statusCode).json(body);
}
