/**
 * /foods route — validates input, calls USDA, and returns normalized JSON.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { getFoodDataFromUsda, parseLimit } from "../services/usdaService.js";
import { resolveFoodQueryParam } from "../validation/foodQuery.js";

export const foodRouter = Router();

foodRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const food = resolveFoodQueryParam(req.query.food, req.query.type);

    const limitParam =
      typeof req.query.limit === "string"
        ? req.query.limit
        : typeof req.query.results === "string"
          ? req.query.results
          : undefined;

    const limit = parseLimit(limitParam);
    const { totalHits, foods } = await getFoodDataFromUsda(food, limit);

    res.json({
      success: true,
      query: food,
      limit,
      totalHits,
      count: foods.length,
      foods,
      // Empty USDA results are not errors; include a friendly hint for clients.
      ...(foods.length === 0 && {
        message: `No foods found for "${food}".`,
      }),
    });
  } catch (error) {
    next(error);
  }
});
