/**
 * Rate limiters to reduce abuse and protect the upstream USDA API quota.
 * On Vercel, limits apply per serverless instance (in-memory store), not globally.
 */
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { env } from "../config/env.js";

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later.",
    },
  });
}

/** Broad protection for all routes except /health. */
export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  handler: rateLimitHandler,
});

/** Tighter cap on /foods because each request triggers an external USDA call. */
export const foodsRateLimiter = rateLimit({
  windowMs: env.foodsRateLimitWindowMs,
  max: env.foodsRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
