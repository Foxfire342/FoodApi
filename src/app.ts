/**
 * Express application factory.
 * Exported for Vercel serverless — no app.listen() here.
 */
import cors from "cors";
import express, { type Express } from "express";
import serverless from "serverless-http";
import { isVercel } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { foodsRateLimiter, globalRateLimiter } from "./middleware/rateLimiter.js";
import { foodRouter } from "./routes/foodRoutes.js";
import { healthRouter } from "./routes/healthRoutes.js";

export function createApp(): Express {
  const app = express();

  // Required behind Vercel's reverse proxy for correct client IPs (rate limiting).
  if (isVercel) {
    app.set("trust proxy", 1);
  }

  app.use(cors());
  app.use(
    express.json({
      strict: true,
    })
  );

  app.use("/health", healthRouter);
  app.use(globalRateLimiter);
  app.use("/foods", foodsRateLimiter, foodRouter);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    });
  });

  app.use(errorHandler);

  return app;
}

export default serverless(createApp());
