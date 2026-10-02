import { Router } from "express";
import { createCustomCrop, getCrop, listCrops } from "../controllers/crops.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const cropsRouter = Router();
cropsRouter.use(requireAuth);

cropsRouter.get("/", asyncHandler(listCrops));
cropsRouter.get("/:id", asyncHandler(getCrop));
cropsRouter.post("/", asyncHandler(createCustomCrop));
