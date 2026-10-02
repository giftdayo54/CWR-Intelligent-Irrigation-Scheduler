import { Router } from "express";
import { calculateForPlanting, calculateStandalone } from "../controllers/yield.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const yieldRouter = Router();
yieldRouter.use(requireAuth);

yieldRouter.post("/calculate", asyncHandler(async (req, res) => calculateStandalone(req, res)));
yieldRouter.get("/:plantingId", asyncHandler(calculateForPlanting));
