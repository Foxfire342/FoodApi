/**
 * Validates the `food` search query before it is sent to USDA.
 * Rejects missing, malformed, or suspicious input early (400 responses).
 */
import { AppError } from "../errors/AppError.js";

const MIN_FOOD_LENGTH = 2;
const MAX_FOOD_LENGTH = 100;

/** Letters, numbers, spaces, and common punctuation in food names. */
const FOOD_QUERY_PATTERN = /^[\p{L}\p{N}\s',.&()-]+$/u;

/** Reject searches that are only digits (not a meaningful food keyword). */
const NUMERIC_ONLY_PATTERN = /^[\d\s]+$/;

function foodValidationError(
  message: string,
  code: string,
  details?: AppError["details"]
): AppError {
  return new AppError(400, message, code, { field: "food", ...details });
}

/**
 * Ensures `food` and legacy `type` are not both sent with different values.
 */
export function resolveFoodQueryParam(
  foodParam: unknown,
  typeParam: unknown
): string {
  const hasFood = foodParam !== undefined && foodParam !== null;
  const hasType = typeParam !== undefined && typeParam !== null;

  if (hasFood && hasType) {
    const foodStr = typeof foodParam === "string" ? foodParam.trim() : null;
    const typeStr = typeof typeParam === "string" ? typeParam.trim() : null;

    if (foodStr && typeStr && foodStr !== typeStr) {
      throw foodValidationError(
        'Query parameters "food" and "type" cannot both be set to different values. Use only "food".',
        "CONFLICTING_FOOD_PARAMS",
        {
          received: `food="${foodStr}", type="${typeStr}"`,
          hint: 'Prefer /foods?food=apple (the "type" parameter is deprecated).',
        }
      );
    }
  }

  return parseFoodQueryParam(hasFood ? foodParam : typeParam);
}

export function parseFoodQueryParam(raw: unknown): string {
  if (raw === undefined || raw === null) {
    throw foodValidationError(
      'Query parameter "food" is required (e.g. /foods?food=apple).',
      "MISSING_FOOD",
      { hint: "Provide a food name or keyword to search the USDA database." }
    );
  }

  // Express may receive repeated query keys as arrays; we only accept a single string.
  if (typeof raw !== "string") {
    throw foodValidationError(
      'Query parameter "food" must be a single text value, not a list.',
      "INVALID_FOOD",
      {
        received: Array.isArray(raw) ? "array" : typeof raw,
        hint: "Pass one search term, e.g. ?food=cheddar%20cheese",
      }
    );
  }

  const food = raw.trim();

  if (!food) {
    throw foodValidationError(
      'Query parameter "food" cannot be empty or whitespace only.',
      "MISSING_FOOD"
    );
  }

  if (food.length < MIN_FOOD_LENGTH) {
    throw foodValidationError(
      `Food search must be at least ${MIN_FOOD_LENGTH} characters (received ${food.length}).`,
      "FOOD_TOO_SHORT",
      { received: food }
    );
  }

  if (food.length > MAX_FOOD_LENGTH) {
    throw foodValidationError(
      `Food search must be at most ${MAX_FOOD_LENGTH} characters (received ${food.length}).`,
      "FOOD_TOO_LONG",
      { received: food.slice(0, 20) + "..." }
    );
  }

  if (NUMERIC_ONLY_PATTERN.test(food)) {
    throw foodValidationError(
      "Food search must include at least one letter; numeric-only values are not valid food types.",
      "INVALID_FOOD_TYPE",
      {
        received: food,
        hint: 'Try a food name such as "apple" or "chicken breast".',
      }
    );
  }

  if (!FOOD_QUERY_PATTERN.test(food)) {
    throw foodValidationError(
      "Food search contains invalid characters. Use letters, numbers, spaces, and common punctuation only.",
      "INVALID_FOOD",
      {
        received: food,
        hint: "Allowed characters include letters, numbers, spaces, and ',.&()-",
      }
    );
  }

  return food;
}
