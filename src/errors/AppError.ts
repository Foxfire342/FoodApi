/**
 * Operational errors we intentionally throw (validation, upstream failures, etc.).
 * The error handler maps these to consistent JSON responses with HTTP status codes.
 */
export interface AppErrorDetails {
  field?: string;
  received?: string;
  hint?: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: AppErrorDetails;

  constructor(
    statusCode: number,
    message: string,
    code: string,
    details?: AppErrorDetails
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = "AppError";
  }
}
