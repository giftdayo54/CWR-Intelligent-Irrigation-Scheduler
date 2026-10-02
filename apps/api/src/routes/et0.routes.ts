import { Router } from "express";
import { calculateClassAPan, calculatePenmanMonteith } from "../controllers/et0.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

export const et0Router = Router();
et0Router.use(requireAuth);

et0Router.post("/penman-monteith", asyncHandler(async (req, res) => calculatePenmanMonteith(req, res)));
et0Router.post("/class-a-pan", asyncHandler(async (req, res) => calculateClassAPan(req, res)));
