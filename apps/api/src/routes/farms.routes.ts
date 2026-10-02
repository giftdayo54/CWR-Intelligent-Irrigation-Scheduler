import { Router } from "express";
import { createFarm, deleteFarm, getFarm, listFarms } from "../controllers/farms.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const farmsRouter = Router();
farmsRouter.use(requireAuth);

farmsRouter.get("/", asyncHandler(listFarms));
farmsRouter.post("/", asyncHandler(createFarm));
farmsRouter.get("/:id", asyncHandler(getFarm));
farmsRouter.delete("/:id", asyncHandler(deleteFarm));
