import { Router } from "express";
import {
  createPlanting,
  getBalanceSeries,
  getDashboard,
  getPlanting,
  getSeasonSeries,
  listPlantings,
  logIrrigationEvent,
} from "../controllers/plantings.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const plantingsRouter = Router();
plantingsRouter.use(requireAuth);

plantingsRouter.get("/", asyncHandler(listPlantings));
plantingsRouter.post("/", asyncHandler(createPlanting));
plantingsRouter.get("/:id", asyncHandler(getPlanting));
plantingsRouter.get("/:id/dashboard", asyncHandler(getDashboard));
plantingsRouter.get("/:id/season-series", asyncHandler(getSeasonSeries));
plantingsRouter.get("/:id/balance", asyncHandler(getBalanceSeries));
plantingsRouter.post("/:id/irrigation-events", asyncHandler(logIrrigationEvent));
