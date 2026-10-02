import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

export async function listCrops(req: Request, res: Response) {
  const crops = await prisma.crop.findMany({
    where: { OR: [{ isCustom: false }, { createdById: req.user?.userId }] },
    orderBy: [{ isCustom: "asc" }, { category: "asc" }, { name: "asc" }],
  });
  res.json(crops);
}

export async function getCrop(req: Request, res: Response) {
  const crop = await prisma.crop.findUnique({ where: { id: req.params.id } });
  if (!crop) throw ApiError.notFound("Crop not found");
  res.json(crop);
}

const createCustomCropSchema = z.object({
  name: z.string().min(1),
  scientificName: z.string().optional(),
  category: z.string().default("custom"),
  kcIni: z.number().positive(),
  kcMid: z.number().positive(),
  kcEnd: z.number().positive(),
  stageInitialDays: z.number().int().positive(),
  stageDevelopmentDays: z.number().int().positive(),
  stageMidDays: z.number().int().positive(),
  stageLateDays: z.number().int().positive(),
  rootDepthMinM: z.number().positive(),
  rootDepthMaxM: z.number().positive(),
  allowableDepletionP: z.number().min(0.05).max(0.9),
  maxCropHeightM: z.number().positive().optional(),
  kyTotal: z.number().positive().optional(),
});

/** Module 2 requirement: "Allow Custom Crop Creation." */
export async function createCustomCrop(req: Request, res: Response) {
  const input = createCustomCropSchema.parse(req.body);
  const crop = await prisma.crop.create({
    data: { ...input, isCustom: true, createdById: req.user!.userId },
  });
  res.status(201).json(crop);
}
