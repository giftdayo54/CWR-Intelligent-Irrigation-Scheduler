import { Router } from "express";
import {
  calculateEffectiveRainfall,
  calculateNetGross,
  generateSchedule,
  getFrequency,
} from "../controllers/irrigation.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const irrigationRouter = Router();
irrigationRouter.use(requireAuth);

irrigationRouter.post("/effective-rainfall", asyncHandler(async (req, res) => calculateEffectiveRainfall(req, res)));
irrigationRouter.post("/net-gross", asyncHandler(async (req, res) => calculateNetGross(req, res)));
irrigationRouter.get("/:plantingId/frequency", asyncHandler(getFrequency));
irrigationRouter.post("/:plantingId/schedule", asyncHandler(generateSchedule));
