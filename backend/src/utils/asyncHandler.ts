import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express handler so that any thrown error (or rejected promise)
 * is forwarded to `next()` and picked up by the centralized error middleware.
 *
 * This eliminates the repetitive `try/catch` block in every controller:
 *
 *   export const getThing = asyncHandler(async (req, res) => {
 *     const thing = await service.find(req.params.id);
 *     if (!thing) throw ApiError.notFound("Thing not found");
 *     sendSuccess(res, 200, { data: thing });
 *   });
 */
export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
