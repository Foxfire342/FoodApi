/**
 * Centralized environment configuration.
 * On Vercel, variables are injected by the platform (Project Settings → Environment Variables).
 * Locally, values are loaded from a `.env` file via dotenv in src/index.ts.
 */

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** True when running on Vercel (serverless). */
export const isVercel = process.env.VERCEL === "1";

export const env = {
  port: parsePositiveInt(process.env.PORT, 3000),
  usdaApiKey: process.env.USDA_API_KEY?.trim() ?? "",
  rateLimitWindowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: parsePositiveInt(process.env.RATE_LIMIT_MAX, 100),
  foodsRateLimitWindowMs: parsePositiveInt(process.env.FOODS_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  foodsRateLimitMax: parsePositiveInt(process.env.FOODS_RATE_LIMIT_MAX, 20),
  usdaRequestTimeoutMs: parsePositiveInt(process.env.USDA_REQUEST_TIMEOUT_MS, 15_000),
} as const;

/** Variable names required for full API functionality (document for Vercel setup). */
export const REQUIRED_ENV_VARS = ["USDA_API_KEY"] as const;

export const OPTIONAL_ENV_VARS = [
  "PORT",
  "RATE_LIMIT_WINDOW_MS",
  "RATE_LIMIT_MAX",
  "FOODS_RATE_LIMIT_WINDOW_MS",
  "FOODS_RATE_LIMIT_MAX",
  "USDA_REQUEST_TIMEOUT_MS",
] as const;
