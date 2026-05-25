/**
 * Local development entry point.
 * Loads .env and starts a persistent HTTP server.
 * Vercel uses api/index.ts instead (no app.listen there).
 */
import "dotenv/config";
import { createApp } from "./app.js";
import { env, isVercel } from "./config/env.js";

const app = createApp();

if (!isVercel) {
  app.listen(env.port, () => {
    console.log(`Food API listening on http://localhost:${env.port}`);
  });
}

export default app;
