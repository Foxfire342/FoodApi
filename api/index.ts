/**
 * Vercel serverless entry point.
 * Vercel routes all requests here; the Express app is exported as the default handler.
 * @see https://vercel.com/docs/frameworks/backend/express
 */
import { createApp } from "../dist/app.js";

const app = createApp();

export default app;
