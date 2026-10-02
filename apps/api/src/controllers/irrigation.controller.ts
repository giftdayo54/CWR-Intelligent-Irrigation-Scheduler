import { Request, Response } from "express";
import { z } from "zod";
import {
  DEFAULT_IRRIGATION_EFFICIENCY,
  IrrigationSystem,
  calculateET0PenmanMonteith,
  calculateETc,
  currentGrowthStage,
  effectiveRainfallUSDA,
  effectiveRainfallUserDefined,
  generateSeasonSchedule,
  grossIrrigationRequirementAllSystems,
  irrigationFrequencyDays,
  kcForStage,
  netIrrigationRequirement,
  rootDepthForStage,
} from "@cwr/fao-engine";
import { ApiError } from "../utils/apiError";
import { loadPlantingContext } from "../services/plantingContext";
import { getStationSeries } from "../services/weatherService";

const effectiveRainfallSchema = z.object({
  method: z.enum(["usda", "user-defined"]).default("usda"),
  monthlyRainfallMm: z.number().min(0),
  monthlyETcMm: z.number().min(0),
  storageMm: z.number().positive().optional(),
  efficiencyFraction: z.number().min(0).max(1).optional(),
});

/** Module 8: Effective rainfall calculator. */
export function calculateEffectiveRainfall(req: Request, res: Response) {
  const input = effectiveRainfallSchema.parse(req.body);
  const result =
    input.method === "usda"
      ? effectiveRainfallUSDA(input.monthlyRainfallMm, input.monthlyETcMm, input.storageMm)
      : effectiveRainfallUserDefined(input.monthlyRainfallMm, input.monthlyETcMm, input.efficiencyFraction ?? 0.8);
  res.json(result);
}

const netGrossSchema = z.object({
  etcMm: z.number().min(0),
  effectiveRainfallMm: z.number().min(0).default(0),
  groundwaterContributionMm: z.number().min(0).default(0),
  soilWaterContributionMm: z.number().min(0).default(0),
  leachingRequirementMm: z.number().min(0).default(0),
});

/** Modules 9 and 10: Net + gross irrigation requirement (all three systems). */
export function calculateNetGross(req: Request, res: Response) {
  const input = netGrossSchema.parse(req.body);
  const irn = netIrrigationRequirement(input);
  const irg = grossIrrigationRequirementAllSystems(irn);
  res.json({ netIrrigationRequirementMm: irn, grossIrrigationRequirementMm: irg });
}

/** GET /api/irrigation/:plantingId/frequency?date= — Module 11 Equation 28,
 * using the planting's current growth stage and the field's soil profile. */
export async function getFrequency(req: Request, res: Response) {
  const ctx = await loadPlantingContext(req.params.plantingId, req.user!.userId);
  const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
  if (!ctx.station || !ctx.stationId) throw ApiError.badRequest("Field has no weather station linked");

  const weather = await getStationSeries(ctx.stationId, new Date(date), new Date(date));
  if (weather.length === 0) throw ApiError.badRequest(`No weather data found for ${date}`);

  const { stage, dayInStage, stageLengthDays } = currentGrowthStage(ctx.crop, ctx.planting.plantingDate, date);
  const kc = kcForStage(ctx.crop, stage, dayInStage, stageLengthDays);
  const rootDepthM = rootDepthForStage(ctx.crop, stage, dayInStage, stageLengthDays);
  const et0 = calculateET0PenmanMonteith(weather[0], ctx.station).ET0;
  const etc = calculateETc(et0, kc);

  const frequencyDays = irrigationFrequencyDays({
    soil: ctx.soil,
    rootDepthM,
    allowableDepletionP: ctx.crop.allowableDepletionP,
    etcMmPerDay: etc,
  });

  res.json({ date, stage, kc, rootDepthM, etcMmPerDay: etc, frequencyDays });
}

const scheduleQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

/** POST /api/irrigation/:plantingId/schedule — Module 11: full-season
 * schedule from stored weather + the growth-stage engine. */
export async function generateSchedule(req: Request, res: Response) {
  const ctx = await loadPlantingContext(req.params.plantingId, req.user!.userId);
  if (!ctx.station || !ctx.stationId) throw ApiError.badRequest("Field has no weather station linked");
  if (!ctx.planting.applicationRateMmPerHour) {
    throw ApiError.badRequest("Set applicationRateMmPerHour on the planting before generating a schedule");
  }

  const { start, end } = scheduleQuerySchema.parse(req.query);
  const startDate = start ?? ctx.planting.plantingDate;
  const endDate = end ?? new Date().toISOString().slice(0, 10);

  const weather = await getStationSeries(ctx.stationId, new Date(startDate), new Date(endDate));
  if (weather.length === 0) throw ApiError.badRequest("No weather data found in the requested range");

  const dailyEtc = weather.map((day) => {
    const { stage, dayInStage, stageLengthDays } = currentGrowthStage(ctx.crop, ctx.planting.plantingDate, day.date);
    const kc = kcForStage(ctx.crop, stage, dayInStage, stageLengthDays);
    const et0 = calculateET0PenmanMonteith(day, ctx.station!).ET0;
    // Simplified flat 80% rainfall-effectiveness assumption for this
    // day-by-day trigger series (Module 11 wants a simple depletion
    // walk, not a monthly total). For the fuller USDA Table 26
    // monthly accounting, see GET /plantings/:id/balance.
    return { date: day.date, etcMm: calculateETc(et0, kc), effectiveRainfallMm: day.rainMm * 0.8 };
  });

  const efficiency =
    ctx.planting.systemEfficiencyOverride ??
    DEFAULT_IRRIGATION_EFFICIENCY[ctx.planting.irrigationSystem.toLowerCase() as IrrigationSystem];

  const events = generateSeasonSchedule(
    dailyEtc,
    ctx.soil,
    (date) => {
      const { stage, dayInStage, stageLengthDays } = currentGrowthStage(ctx.crop, ctx.planting.plantingDate, date);
      return rootDepthForStage(ctx.crop, stage, dayInStage, stageLengthDays);
    },
    ctx.crop.allowableDepletionP,
    efficiency,
    ctx.planting.applicationRateMmPerHour,
    ctx.planting.areaHa
  );

  res.json({ start: startDate, end: endDate, events });
}
