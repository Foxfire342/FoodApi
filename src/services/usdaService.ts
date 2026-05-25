/**
 * USDA FoodData Central integration.
 * Fetches search results, maps nutrients to a stable client format, and surfaces upstream errors.
 */
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { mapNetworkError } from "../errors/mapNetworkError.js";
import type {
  FoodMacros,
  FoodSummary,
  UsdaFoodItem,
  UsdaFoodNutrient,
  UsdaFoodSearchResult,
} from "../types/usda.js";
import { parseUsdaSearchResponse } from "./parseUsdaResponse.js";

const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const DEFAULT_LIMIT = 10;
const MIN_LIMIT = 1;
const MAX_LIMIT = 200; // USDA allows up to 200 per page

/**
 * Standard FDC nutrient identifiers (also matched by legacy nutrientNumber).
 * @see https://fdc.nal.usda.gov/api-guide
 */
const NUTRIENT_IDS = {
  energy: 1008,
  protein: 1003,
  fat: 1004,
  carbohydrates: 1005,
} as const;

const NUTRIENT_NUMBERS = {
  energy: "208",
  protein: "203",
  fat: "204",
  carbohydrates: "205",
} as const;

function getApiKey(): string {
  const key = env.usdaApiKey;
  if (!key) {
    throw new AppError(
      503,
      "USDA API key is not configured. Set USDA_API_KEY in your environment.",
      "MISSING_API_KEY",
      { hint: "Sign up at https://fdc.nal.usda.gov/api-key-signup.html" }
    );
  }
  return key;
}

function normalizeUnit(unit: string | undefined): string {
  return (unit ?? "").trim().toUpperCase();
}

function isGramUnit(unit: string): boolean {
  return unit === "G" || unit === "GRM" || unit === "GRAM";
}

function isCalorieUnit(unit: string): boolean {
  return unit === "KCAL" || unit === "CAL" || unit === "KILOCALORIE" || unit === "KILOCALORIES";
}

/** Match by FDC nutrient ID, legacy number, or a fallback name pattern. */
function matchesNutrient(
  nutrient: UsdaFoodNutrient,
  nutrientId: number,
  nutrientNumber: string,
  namePatterns: RegExp[]
): boolean {
  if (nutrient.nutrientId === nutrientId) {
    return true;
  }
  if (nutrient.nutrientNumber === nutrientNumber) {
    return true;
  }
  const name = nutrient.nutrientName?.toLowerCase() ?? "";
  return namePatterns.some((pattern) => pattern.test(name));
}

/**
 * Find the first matching nutrient value in a food's nutrient list.
 * Unit checks avoid picking calories when labeled in kJ, or macros in non-gram units.
 */
function pickNutrientValue(
  nutrients: UsdaFoodNutrient[] | undefined,
  nutrientId: number,
  nutrientNumber: string,
  namePatterns: RegExp[],
  options: { requireGrams?: boolean; requireCalories?: boolean } = {}
): number | null {
  if (!nutrients?.length) {
    return null;
  }

  const match = nutrients.find((nutrient) => {
    if (nutrient.value == null || Number.isNaN(nutrient.value)) {
      return false;
    }
    if (!matchesNutrient(nutrient, nutrientId, nutrientNumber, namePatterns)) {
      return false;
    }

    const unit = normalizeUnit(nutrient.unitName);
    if (options.requireGrams && unit && !isGramUnit(unit)) {
      return false;
    }
    if (options.requireCalories && unit && !isCalorieUnit(unit)) {
      return false;
    }

    return true;
  });

  return match?.value ?? null;
}

function extractMacros(nutrients: UsdaFoodNutrient[] | undefined): FoodMacros {
  return {
    proteinG: pickNutrientValue(
      nutrients,
      NUTRIENT_IDS.protein,
      NUTRIENT_NUMBERS.protein,
      [/^protein$/i],
      { requireGrams: true }
    ),
    carbohydratesG: pickNutrientValue(
      nutrients,
      NUTRIENT_IDS.carbohydrates,
      NUTRIENT_NUMBERS.carbohydrates,
      [/carbohydrate/i],
      { requireGrams: true }
    ),
    fatG: pickNutrientValue(
      nutrients,
      NUTRIENT_IDS.fat,
      NUTRIENT_NUMBERS.fat,
      [/lipid|fat/i],
      { requireGrams: true }
    ),
  };
}

/** Shrink a raw USDA food record into the fields our API exposes. */
function extractFoodSummary(food: UsdaFoodItem): FoodSummary {
  const calories = pickNutrientValue(
    food.foodNutrients,
    NUTRIENT_IDS.energy,
    NUTRIENT_NUMBERS.energy,
    [/^energy$/i],
    { requireCalories: true }
  );

  return {
    fdcId: food.fdcId,
    description: food.description,
    brandName: food.brandName ?? food.brandOwner ?? null,
    servingSize: food.servingSize ?? null,
    servingSizeUnit: food.servingSizeUnit ?? null,
    calories,
    macros: extractMacros(food.foodNutrients),
  };
}

/** Low-level HTTP call to USDA; throws AppError on network, HTTP, or parse failures. */
async function fetchUsdaSearch(query: string, limit: number) {
  const apiKey = getApiKey();
  const url = new URL(USDA_SEARCH_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("pageNumber", "1");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(env.usdaRequestTimeoutMs),
    });
  } catch (error) {
    throw mapNetworkError(error);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw mapUsdaHttpError(response.status, responseText);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new AppError(
      502,
      "USDA returned a response that could not be parsed as JSON.",
      "USDA_PARSE_ERROR",
      {
        hint: "The upstream service sent malformed data.",
        received: truncateForClient(responseText),
      }
    );
  }

  return parseUsdaSearchResponse(parsed);
}

function truncateForClient(text: string, maxLength = 120): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}...`;
}

function mapUsdaHttpError(status: number, body: string): AppError {
  if (status === 403 || status === 401) {
    return new AppError(
      502,
      "USDA API rejected the request. Verify that USDA_API_KEY is valid and active.",
      "USDA_AUTH_ERROR",
      { hint: "Check your API key at https://fdc.nal.usda.gov/api-key-signup.html" }
    );
  }

  if (status === 429) {
    return new AppError(
      429,
      "USDA API rate limit exceeded. Please wait and try again later.",
      "USDA_RATE_LIMIT",
      { hint: "USDA allows roughly 1,000 requests per hour per API key." }
    );
  }

  if (status >= 500) {
    return new AppError(
      502,
      "USDA FoodData Central is temporarily unavailable. Please try again later.",
      "USDA_SERVER_ERROR",
      { received: `HTTP ${status}` }
    );
  }

  if (status === 400) {
    return new AppError(
      400,
      "USDA rejected the search request as invalid.",
      "USDA_BAD_REQUEST",
      {
        hint: "The search query or parameters may be unsupported by the upstream API.",
        received: truncateForClient(body),
      }
    );
  }

  return new AppError(
    502,
    `USDA API returned an unexpected error (HTTP ${status}).`,
    "USDA_ERROR",
    { received: truncateForClient(body) }
  );
}

/**
 * Fetches foods from USDA FoodData Central and returns normalized summaries.
 * An empty `foods` array means no matches — that is not treated as an error.
 */
export async function getFoodDataFromUsda(
  query: string,
  limit: number
): Promise<UsdaFoodSearchResult> {
  const data = await fetchUsdaSearch(query, limit);
  const rawFoods = data.foods ?? [];

  if (rawFoods.length === 0) {
    return {
      totalHits: data.totalHits ?? 0,
      foods: [],
    };
  }

  const foods = rawFoods.map(extractFoodSummary);

  return {
    totalHits: data.totalHits ?? foods.length,
    foods,
  };
}

/** Validates the optional `limit` / `results` query parameter. */
export function parseLimit(raw: string | undefined): number {
  if (raw === undefined || raw === "") {
    return DEFAULT_LIMIT;
  }

  const limit = Number.parseInt(raw, 10);
  if (Number.isNaN(limit) || !Number.isInteger(limit)) {
    throw new AppError(
      400,
      `Invalid limit "${raw}". Must be a whole number between ${MIN_LIMIT} and ${MAX_LIMIT}.`,
      "INVALID_LIMIT",
      { field: "limit", received: raw }
    );
  }

  if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
    throw new AppError(
      400,
      `Limit must be between ${MIN_LIMIT} and ${MAX_LIMIT} (received ${limit}).`,
      "INVALID_LIMIT",
      { field: "limit", received: String(limit) }
    );
  }

  return limit;
}
