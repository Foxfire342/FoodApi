/**
 * /health route — reports whether the API process is up and ready to serve traffic.
 * Does not call USDA; only checks local configuration.
 */
import { Router, type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { env, isVercel } from "../config/env.js";

function getPackageVersion(): string {
  try {
    const packagePath = join(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

const version = getPackageVersion();

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  const usdaApiKeyConfigured = Boolean(env.usdaApiKey);

  // Process is running, but food searches will fail until the API key is set.
  const status = usdaApiKeyConfigured ? "healthy" : "degraded";

  res.status(200).json({
    success: true,
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version,
    runtime: isVercel ? "vercel-serverless" : "node",
    checks: {
      api: "ok",
      usdaApiKey: usdaApiKeyConfigured ? "configured" : "missing",
    },
  });
});
