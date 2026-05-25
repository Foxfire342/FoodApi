import { AppError } from "../errors/AppError.js";
import type { UsdaFoodItem, UsdaSearchResponse } from "../types/usda.js";

function parsingError(message: string, details?: AppError["details"]): AppError {
  return new AppError(
    502,
    message,
    "USDA_PARSE_ERROR",
    { field: "usdaResponse", ...details }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates the top-level USDA /foods/search JSON before we use it.
 */
export function parseUsdaSearchResponse(raw: unknown): UsdaSearchResponse {
  if (!isRecord(raw)) {
    throw parsingError(
      "USDA returned a response that is not a JSON object.",
      { hint: "Expected an object with optional foods and totalHits fields." }
    );
  }

  if (raw.foods !== undefined && !Array.isArray(raw.foods)) {
    throw parsingError('USDA response field "foods" must be an array.', {
      received: typeof raw.foods,
    });
  }

  if (raw.totalHits !== undefined && typeof raw.totalHits !== "number") {
    throw parsingError('USDA response field "totalHits" must be a number.', {
      received: typeof raw.totalHits,
    });
  }

  const foods = raw.foods as unknown[] | undefined;

  return {
    totalHits: typeof raw.totalHits === "number" ? raw.totalHits : undefined,
    currentPage: typeof raw.currentPage === "number" ? raw.currentPage : undefined,
    totalPages: typeof raw.totalPages === "number" ? raw.totalPages : undefined,
    foods: foods?.map((item, index) => parseUsdaFoodItem(item, index)),
  };
}

/**
 * Validates a single food record from USDA before mapping nutrients.
 */
export function parseUsdaFoodItem(item: unknown, index: number): UsdaFoodItem {
  if (!isRecord(item)) {
    throw parsingError(`Food entry at index ${index} is not a valid object.`, {
      received: item === null ? "null" : typeof item,
    });
  }

  if (typeof item.fdcId !== "number" || !Number.isFinite(item.fdcId)) {
    throw parsingError(`Food entry at index ${index} is missing a valid fdcId.`, {
      field: "fdcId",
      received: String(item.fdcId),
    });
  }

  if (typeof item.description !== "string" || !item.description.trim()) {
    throw parsingError(`Food entry at index ${index} is missing a description.`, {
      field: "description",
    });
  }

  if (item.foodNutrients !== undefined && !Array.isArray(item.foodNutrients)) {
    throw parsingError(`Food entry at index ${index} has an invalid foodNutrients field.`, {
      field: "foodNutrients",
      received: typeof item.foodNutrients,
    });
  }

  return {
    fdcId: item.fdcId as number,
    description: item.description as string,
    dataType: typeof item.dataType === "string" ? item.dataType : undefined,
    brandOwner: typeof item.brandOwner === "string" ? item.brandOwner : undefined,
    brandName: typeof item.brandName === "string" ? item.brandName : undefined,
    ingredients: typeof item.ingredients === "string" ? item.ingredients : undefined,
    servingSize: typeof item.servingSize === "number" ? item.servingSize : undefined,
    servingSizeUnit:
      typeof item.servingSizeUnit === "string" ? item.servingSizeUnit : undefined,
    foodNutrients: item.foodNutrients as UsdaFoodItem["foodNutrients"],
  };
}
