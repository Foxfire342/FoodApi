/**
 * Express error-handling middleware.
 * Converts known error types into consistent JSON with appropriate HTTP status codes.
 */
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import { mapNetworkError } from "../errors/mapNetworkError.js";

export interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: AppError["details"];
  };
}

function sendError(res: Response, statusCode: number, body: ErrorBody): void {
  res.status(statusCode).json(body);
}

/** Express JSON body parser throws this when the request body is malformed. */
function isJsonSyntaxError(err: unknown): err is SyntaxError & { status?: number; body?: unknown } {
  return (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as { status: number }).status === 400 &&
    "body" in err
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isJsonSyntaxError(err)) {
    sendError(res, 400, {
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON.",
        details: {
          hint: "Ensure the body is valid JSON when sending Content-Type: application/json.",
        },
      },
    });
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // fetch() and other I/O failures that were not wrapped earlier.
  if (err instanceof TypeError || (err instanceof Error && err.name === "AbortError")) {
    const networkError = mapNetworkError(err);
    sendError(res, networkError.statusCode, {
      success: false,
      error: {
        code: networkError.code,
        message: networkError.message,
        ...(networkError.details && { details: networkError.details }),
      },
    });
    return;
  }

  console.error("Unhandled error:", err);
  sendError(res, 500, {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      details: {
        hint: "If this persists, check server logs for more information.",
      },
    },
  });
}
