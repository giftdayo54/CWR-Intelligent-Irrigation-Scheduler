import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

const soilTextureEnum = z.enum(["SAND", "LOAMY_SAND", "SANDY_LOAM", "LOAM", "CLAY_LOAM", "CLAY"]);

const createFieldSchema = z.object({
  farmId: z.string(),
  stationId: z.string().optional(),
  name: z.string().min(1),
  areaHa: z.number().positive(),
  soilTexture: soilTextureEnum,
  totalAvailableMoistureMmPerM: z.number().positive().optional(),
});

async function assertFarmOwnership(farmId: string, userId: string) {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!farm) throw ApiError.notFound("Farm not found");
}

export async function listFields(req: Request, res: Response) {
  const farmId = req.query.farmId as string | undefined;
  if (farmId) await assertFarmOwnership(farmId, req.user!.userId);
  const fields = await prisma.field.findMany({
    where: farmId ? { farmId } : { farm: { userId: req.user!.userId } },
    include: { plantings: { include: { crop: true }, where: { status: "ACTIVE" } } },
  });
  res.json(fields);
}

export async function createField(req: Request, res: Response) {
  const input = createFieldSchema.parse(req.body);
  await assertFarmOwnership(input.farmId, req.user!.userId);
  const field = await prisma.field.create({ data: input });
  res.status(201).json(field);
}

export async function getField(req: Request, res: Response) {
  const field = await prisma.field.findFirst({
    where: { id: req.params.id, farm: { userId: req.user!.userId } },
    include: { plantings: { include: { crop: true } }, station: true },
  });
  if (!field) throw ApiError.notFound("Field not found");
  res.json(field);
}

export async function updateField(req: Request, res: Response) {
  const field = await prisma.field.findFirst({ where: { id: req.params.id, farm: { userId: req.user!.userId } } });
  if (!field) throw ApiError.notFound("Field not found");
  const input = createFieldSchema.partial().parse(req.body);
  const updated = await prisma.field.update({ where: { id: field.id }, data: input });
  res.json(updated);
}
