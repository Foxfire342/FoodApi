import { AppError } from "./AppError.js";

interface ErrnoCause {
  code?: string;
  message?: string;
}

/**
 * Turns fetch/network failures into AppError with actionable messages and correct status codes.
 */
export function mapNetworkError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    const name = error.name;
    const message = error.message.toLowerCase();
    const cause = error.cause as ErrnoCause | undefined;
    const code = cause?.code ?? (error as ErrnoCause).code;

    if (name === "AbortError" || name === "TimeoutError" || message.includes("timeout")) {
      return new AppError(
        504,
        "The request to USDA FoodData Central timed out. Please try again shortly.",
        "USDA_TIMEOUT",
        { hint: "The upstream service did not respond in time." }
      );
    }

    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return new AppError(
        503,
        "Could not resolve the USDA FoodData Central host. Check your network connection.",
        "USDA_DNS_ERROR",
        { hint: "DNS lookup failed for api.nal.usda.gov." }
      );
    }

    if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EPIPE") {
      return new AppError(
        503,
        "The connection to USDA FoodData Central was interrupted. Please try again.",
        "USDA_CONNECTION_ERROR",
        { hint: code ? `Network code: ${code}` : undefined }
      );
    }

    if (name === "TypeError" && message.includes("fetch")) {
      return new AppError(
        503,
        "Unable to reach USDA FoodData Central. Verify your network connection and try again.",
        "USDA_NETWORK_ERROR",
        { hint: error.message }
      );
    }
  }

  return new AppError(
    503,
    "Unable to reach USDA FoodData Central due to a network error.",
    "USDA_NETWORK_ERROR",
    { hint: "An unexpected network failure occurred." }
  );
}
