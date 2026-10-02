import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

const createStationSchema = z.object({
  farmId: z.string(),
  name: z.string().min(1),
  latitudeDeg: z.number().min(-90).max(90),
  longitudeDeg: z.number().min(-180).max(180),
  elevationM: z.number(),
  anemometerHeightM: z.number().positive().default(2),
});

async function assertFarmOwnership(farmId: string, userId: string) {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!farm) throw ApiError.notFound("Farm not found");
}

export async function listStations(req: Request, res: Response) {
  const farmId = req.query.farmId as string | undefined;
  if (farmId) await assertFarmOwnership(farmId, req.user!.userId);
  const stations = await prisma.weatherStation.findMany({
    where: farmId ? { farmId } : { farm: { userId: req.user!.userId } },
  });
  res.json(stations);
}

export async function createStation(req: Request, res: Response) {
  const input = createStationSchema.parse(req.body);
  await assertFarmOwnership(input.farmId, req.user!.userId);
  const station = await prisma.weatherStation.create({ data: input });
  res.status(201).json(station);
}

export async function getStation(req: Request, res: Response) {
  const station = await prisma.weatherStation.findFirst({
    where: { id: req.params.id, farm: { userId: req.user!.userId } },
  });
  if (!station) throw ApiError.notFound("Weather station not found");
  res.json(station);
}
