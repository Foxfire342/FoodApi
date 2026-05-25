# Food API

Express + TypeScript server that searches the [USDA FoodData Central](https://fdc.nal.usda.gov/) database.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add your API key from [data.gov signup](https://fdc.nal.usda.gov/api-key-signup.html):

   ```
   USDA_API_KEY=your_key_here
   PORT=3000
   ```

3. Run in development:

   ```bash
   npm run dev
   ```

## Deploy to Vercel

This API is configured as a [Vercel serverless function](https://vercel.com/docs/frameworks/backend/express). All routes are handled by `api/index.ts`, which exports the Express app (no `app.listen` on Vercel).

1. Install the [Vercel CLI](https://vercel.com/docs/cli) or connect your Git repository on [vercel.com](https://vercel.com).
2. Set environment variables in **Project Settings → Environment Variables** (Production, Preview, and Development):

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `USDA_API_KEY` | Yes | USDA FoodData Central API key |
   | `RATE_LIMIT_WINDOW_MS` | No | Global rate limit window (ms) |
   | `RATE_LIMIT_MAX` | No | Global max requests per window |
   | `FOODS_RATE_LIMIT_WINDOW_MS` | No | `/foods` rate limit window (ms) |
   | `FOODS_RATE_LIMIT_MAX` | No | `/foods` max requests per window |
   | `USDA_REQUEST_TIMEOUT_MS` | No | USDA fetch timeout (ms, default `15000`) |

   Do not commit `.env` — Vercel injects variables at runtime. `VERCEL=1` is set automatically.

3. Deploy:

   ```bash
   npm run build
   vercel --prod
   ```

   `vercel.json` runs `npm run build` before deploy so `api/index.ts` can import the compiled app from `dist/`.

4. Verify:

   ```bash
   curl https://your-project.vercel.app/health
   curl "https://your-project.vercel.app/foods?food=apple&limit=3"
   ```

## Endpoints

### `GET /foods`

Search USDA foods by keyword.

| Query param | Required | Description |
|-------------|----------|-------------|
| `food`      | Yes      | Food to search for (2–100 chars; e.g. `apple`, `cheddar cheese`). Alias: `type` |
| `limit`     | No       | Number of results (1–200, default `10`). Alias: `results` |

**Example**

```bash
curl "http://localhost:3000/foods?food=apple&limit=5"
```

**Success response**

```json
{
  "success": true,
  "query": "apple",
  "limit": 5,
  "totalHits": 1234,
  "count": 5,
  "foods": [
    {
      "fdcId": 1750340,
      "description": "Apples, raw, with skin",
      "brandName": null,
      "servingSize": 100,
      "servingSizeUnit": "g",
      "calories": 52,
      "macros": {
        "proteinG": 0.26,
        "carbohydratesG": 13.8,
        "fatG": 0.17
      }
    }
  ]
}
```

**Error response**

All errors use the same shape. Optional `details` includes `field`, `received`, and `hint` when helpful.

```json
{
  "success": false,
  "error": {
    "code": "INVALID_FOOD_TYPE",
    "message": "Food search must include at least one letter; numeric-only values are not valid food types.",
    "details": {
      "field": "food",
      "received": "12345",
      "hint": "Try a food name such as \"apple\" or \"chicken breast\"."
    }
  }
}
```

| Code | HTTP | When |
|------|------|------|
| `MISSING_FOOD` | 400 | `food` query param omitted or empty |
| `INVALID_FOOD` | 400 | Wrong type, bad characters, or array value |
| `INVALID_FOOD_TYPE` | 400 | Numeric-only search (not a valid food keyword) |
| `FOOD_TOO_SHORT` / `FOOD_TOO_LONG` | 400 | Length outside 2–100 characters |
| `CONFLICTING_FOOD_PARAMS` | 400 | Both `food` and `type` set to different values |
| `INVALID_LIMIT` | 400 | `limit` / `results` not a valid integer 1–200 |
| `INVALID_JSON` | 400 | Malformed JSON request body |
| `USDA_TIMEOUT` | 504 | USDA request timed out |
| `USDA_NETWORK_ERROR` / `USDA_DNS_ERROR` / `USDA_CONNECTION_ERROR` | 503 | Cannot reach USDA |
| `USDA_PARSE_ERROR` | 502 | USDA response was not valid JSON or structure |
| `USDA_AUTH_ERROR` | 502 | Invalid or missing USDA API key |
| `USDA_RATE_LIMIT` | 429 | USDA hourly rate limit exceeded |
| `MISSING_API_KEY` | 503 | `USDA_API_KEY` not set in environment |
| `RATE_LIMIT_EXCEEDED` | 429 | This API’s rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### `GET /health`

Returns API status (not rate-limited).

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-05-25T12:00:00.000Z",
  "uptime": 42,
  "version": "1.0.0",
  "runtime": "vercel-serverless",
  "checks": {
    "api": "ok",
    "usdaApiKey": "configured"
  }
}
```

`status` is `degraded` when `USDA_API_KEY` is not set. `checks.usdaApiKey` is `missing` in that case. `runtime` is `node` when running locally.

### Rate limiting

| Scope | Default | Env vars |
|-------|---------|----------|
| All routes except `/health` | 100 requests / 15 min | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| `/foods` only | 20 requests / 1 min | `FOODS_RATE_LIMIT_WINDOW_MS`, `FOODS_RATE_LIMIT_MAX` |

Exceeded limits return `429` with `RATE_LIMIT_EXCEEDED`.
