import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { loadPlantingContext } from "../services/plantingContext";
import { getStationSeries } from "../services/weatherService";
import { simulatePlanting, projectNextIrrigationDate } from "../services/balanceService";
import { buildSeasonSeries, growthStageSummary, DEFAULT_IRRIGATION_EFFICIENCY, IrrigationSystem } from "@cwr/fao-engine";

const createPlantingSchema = z.object({
  fieldId: z.string(),
  cropId: z.string(),
  plantingDate: z.string(),
  expectedHarvestDate: z.string().optional(),
  variety: z.string().optional(),
  climateZone: z.string().optional(),
  irrigationSystem: z.enum(["SURFACE", "SPRINKLER", "DRIP"]).default("SPRINKLER"),
  systemEfficiencyOverride: z.number().min(0.1).max(1).optional(),
  applicationRateMmPerHour: z.number().positive().optional(),
});

async function assertFieldOwnership(fieldId: string, userId: string) {
  const field = await prisma.field.findFirst({ where: { id: fieldId, farm: { userId } } });
  if (!field) throw ApiError.notFound("Field not found");
}

export async function createPlanting(req: Request, res: Response) {
  const input = createPlantingSchema.parse(req.body);
  await assertFieldOwnership(input.fieldId, req.user!.userId);
  const planting = await prisma.planting.create({
    data: {
      ...input,
      plantingDate: new Date(input.plantingDate + "T00:00:00.000Z"),
      expectedHarvestDate: input.expectedHarvestDate ? new Date(input.expectedHarvestDate + "T00:00:00.000Z") : undefined,
    },
    include: { crop: true, field: true },
  });
  res.status(201).json(planting);
}

export async function listPlantings(req: Request, res: Response) {
  const fieldId = req.query.fieldId as string | undefined;
  if (fieldId) await assertFieldOwnership(fieldId, req.user!.userId);
  const plantings = await prisma.planting.findMany({
    where: fieldId ? { fieldId } : { field: { farm: { userId: req.user!.userId } } },
    include: { crop: true, field: true },
    orderBy: { plantingDate: "desc" },
  });
  res.json(plantings);
}

export async function getPlanting(req: Request, res: Response) {
  const planting = await prisma.planting.findFirst({
    where: { id: req.params.id, field: { farm: { userId: req.user!.userId } } },
    include: { crop: true, field: { include: { station: true } }, irrigationEvents: { orderBy: { date: "desc" }, take: 20 } },
  });
  if (!planting) throw ApiError.notFound("Planting not found");
  res.json(planting);
}

/** Module 13: Farm Dashboard widget for one planting on one date. */
export async function getDashboard(req: Request, res: Response) {
  const ctx = await loadPlantingContext(req.params.id, req.user!.userId);
  const asOfDate = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  const stage = growthStageSummary(ctx.crop, ctx.planting.plantingDate, asOfDate);

  const efficiency =
    ctx.planting.systemEfficiencyOverride ??
    DEFAULT_IRRIGATION_EFFICIENCY[ctx.planting.irrigationSystem.toLowerCase() as IrrigationSystem];

  let soilMoisture: unknown = null;
  let nextIrrigationDate: string | null = null;
  let netIrrigationRequirementMm: number | null = null;
  let grossIrrigationRequirementMm: number | null = null;

  if (ctx.station && ctx.stationId) {
    const weather = await getStationSeries(ctx.stationId, new Date(ctx.planting.plantingDate), new Date(asOfDate));
    if (weather.length > 0) {
      const events: Array<{ date: Date; grossDepthMm: number }> = await prisma.irrigationEvent.findMany({ where: { plantingId: ctx.planting.id } });
      const irrigationByDate = new Map(events.map((e) => [e.date.toISOString().slice(0, 10), e.grossDepthMm] as [string, number]));
      const series = simulatePlanting(weather, ctx.station, ctx.crop, ctx.soil, ctx.planting.plantingDate, irrigationByDate);
      const last = series[series.length - 1];
      soilMoisture = last;
      nextIrrigationDate = projectNextIrrigationDate(series);
      netIrrigationRequirementMm = last.depletionMm; // depth needed to refill the root zone to field capacity
      grossIrrigationRequirementMm = round(netIrrigationRequirementMm / efficiency, 1);
    }
  }

  res.json({
    plantingId: ctx.planting.id,
    date: asOfDate,
    crop: ctx.crop.name,
    plantingDate: ctx.planting.plantingDate,
    daysAfterPlanting: stage.daysAfterPlanting,
    currentStage: stage.stage,
    currentKc: stage.kc,
    rootDepthM: stage.rootDepthM,
    allowableDepletionP: stage.allowableDepletionP,
    soilMoisture,
    netIrrigationRequirementMm,
    grossIrrigationRequirementMm,
    nextIrrigationDate,
  });
}

/** Modules 4/5/12: full-season Kc curve, root-depth curve and growth
 * timeline (auto-derived, never manually selected). */
export async function getSeasonSeries(req: Request, res: Response) {
  const ctx = await loadPlantingContext(req.params.id, req.user!.userId);
  const series = buildSeasonSeries(ctx.crop, ctx.planting.plantingDate);
  res.json({ crop: ctx.crop.name, plantingDate: ctx.planting.plantingDate, series });
}

/** Module 7: daily ETc + soil-water-balance series over a date range. */
export async function getBalanceSeries(req: Request, res: Response) {
  const ctx = await loadPlantingContext(req.params.id, req.user!.userId);
  if (!ctx.station || !ctx.stationId) throw ApiError.badRequest("Field has no weather station linked");

  const start = (req.query.start as string) ?? ctx.planting.plantingDate;
  const end = (req.query.end as string) ?? new Date().toISOString().slice(0, 10);
  const weather = await getStationSeries(ctx.stationId, new Date(start), new Date(end));
  const events: Array<{ date: Date; grossDepthMm: number }> = await prisma.irrigationEvent.findMany({ where: { plantingId: ctx.planting.id } });
  const irrigationByDate = new Map(events.map((e) => [e.date.toISOString().slice(0, 10), e.grossDepthMm] as [string, number]));

  const series = simulatePlanting(weather, ctx.station, ctx.crop, ctx.soil, ctx.planting.plantingDate, irrigationByDate);
  res.json({ crop: ctx.crop.name, start, end, series });
}

const logIrrigationSchema = z.object({
  date: z.string(),
  grossDepthMm: z.number().positive(),
  durationHours: z.number().positive().optional(),
});

export async function logIrrigationEvent(req: Request, res: Response) {
  const ctx = await loadPlantingContext(req.params.id, req.user!.userId);
  const input = logIrrigationSchema.parse(req.body);
  const efficiency =
    ctx.planting.systemEfficiencyOverride ??
    DEFAULT_IRRIGATION_EFFICIENCY[ctx.planting.irrigationSystem.toLowerCase() as IrrigationSystem];
  const event = await prisma.irrigationEvent.create({
    data: {
      plantingId: ctx.planting.id,
      date: new Date(input.date + "T00:00:00.000Z"),
      netDepthMm: round(input.grossDepthMm * efficiency, 1),
      grossDepthMm: input.grossDepthMm,
      durationHours: input.durationHours,
      source: "MANUAL_LOG",
    },
  });
  res.status(201).json(event);
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
