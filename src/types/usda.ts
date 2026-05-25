/**
 * Type definitions for USDA FoodData Central API responses
 * and the simplified shape returned by this API.
 */

/** A single nutrient entry on a food record from USDA search results. */
export interface UsdaFoodNutrient {
  nutrientId?: number;
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
}

/** One food item as returned by the USDA /foods/search endpoint. */
export interface UsdaFoodItem {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaFoodNutrient[];
}

/** Top-level payload from GET /fdc/v1/foods/search. */
export interface UsdaSearchResponse {
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: UsdaFoodItem[];
}

/** Macronutrients in grams; null when USDA did not provide a value. */
export interface FoodMacros {
  proteinG: number | null;
  carbohydratesG: number | null;
  fatG: number | null;
}

/** Normalized food record sent to API clients. */
export interface FoodSummary {
  fdcId: number;
  description: string;
  brandName: string | null;
  servingSize: number | null;
  servingSizeUnit: string | null;
  calories: number | null;
  macros: FoodMacros;
}

export interface UsdaFoodSearchResult {
  totalHits: number;
  foods: FoodSummary[];
}
