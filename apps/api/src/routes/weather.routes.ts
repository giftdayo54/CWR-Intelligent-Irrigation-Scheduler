import { Router } from "express";
import multer from "multer";
import { getSeries, importMetWorkbook, manualEntry } from "../controllers/weather.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const weatherRouter = Router();
weatherRouter.use(requireAuth);

weatherRouter.get("/:stationId", asyncHandler(getSeries));
weatherRouter.post("/:stationId/import", upload.single("file"), asyncHandler(importMetWorkbook));
weatherRouter.post("/:stationId/manual", asyncHandler(manualEntry));
