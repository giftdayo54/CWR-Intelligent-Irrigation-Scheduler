import { Router } from "express";
import { createStation, getStation, listStations } from "../controllers/stations.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const stationsRouter = Router();
stationsRouter.use(requireAuth);

stationsRouter.get("/", asyncHandler(listStations));
stationsRouter.post("/", asyncHandler(createStation));
stationsRouter.get("/:id", asyncHandler(getStation));
