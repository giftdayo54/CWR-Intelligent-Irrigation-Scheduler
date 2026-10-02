import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

const createFarmSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
});

export async function listFarms(req: Request, res: Response) {
  const farms = await prisma.farm.findMany({
    where: { userId: req.user!.userId },
    include: { fields: true, stations: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(farms);
}

export async function createFarm(req: Request, res: Response) {
  const input = createFarmSchema.parse(req.body);
  const farm = await prisma.farm.create({ data: { ...input, userId: req.user!.userId } });
  res.status(201).json(farm);
}

export async function getFarm(req: Request, res: Response) {
  const farm = await prisma.farm.findFirst({
    where: { id: req.params.id, userId: req.user!.userId },
    include: { fields: { include: { plantings: true } }, stations: true },
  });
  if (!farm) throw ApiError.notFound("Farm not found");
  res.json(farm);
}

export async function deleteFarm(req: Request, res: Response) {
  const farm = await prisma.farm.findFirst({ where: { id: req.params.id, userId: req.user!.userId } });
  if (!farm) throw ApiError.notFound("Farm not found");
  await prisma.farm.delete({ where: { id: farm.id } });
  res.status(204).send();
}
