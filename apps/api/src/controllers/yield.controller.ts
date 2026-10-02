import { Request, Response } from "express";
import { z } from "zod";
import { calculateYieldResponse } from "@cwr/fao-engine";
import { ApiError } from "../utils/apiError";
import { loadPlantingContext } from "../services/plantingContext";
import { getStationSeries } from "../services/weatherService";
import { simulatePlanting } from "../services/balanceService";
import { prisma } from "../lib/prisma";

const standaloneSchema = z.object({
  ky: z.number().positive(),
  etcMm: z.number().positive(),
  etcAdjMm: z.number().min(0),
});

/** POST /api/yield/calculate — standalone Ky calculator (Equation 27),
 * for any user-supplied ETc / ETc_adj (e.g. from a field trial). */
export function calculateStandalone(req: Request, res: Response) {
  const input = standaloneSchema.parse(req.body);
  res.json(calculateYieldResponse(input));
}

/**
 * GET /api/yield/:plantingId?start=&end= — derives ETc (potential) and
 * an approximate ETc_adj from the planting's own soil-water-balance
 * simulation over the range: ETc_adj = ETc - sum(max(depletion - RAM, 0)),
 * i.e. potential water use less the portion of each day's depletion
 * that exceeded readily available moisture (an engineering proxy for
 * water-stress reduction — Module 4 takes ETc_adj as a known input
 * rather than deriving it from a water balance, so this is flagged as
 * an approximation; pass your own measured values to /calculate for
 * an exact Equation 27 result instead).
 */
export async function calculateForPlanting(req: Request, res: Response) {
  const ctx = await loadPlantingContext(req.params.plantingId, req.user!.userId);
  if (!ctx.crop.ky?.total) {
    throw ApiError.badRequest("This crop has no Ky value on file — use POST /api/yield/calculate with your own Ky instead");
  }
  if (!ctx.station || !ctx.stationId) throw ApiError.badRequest("Field has no weather station linked");

  const start = (req.query.start as string) ?? ctx.planting.plantingDate;
  const end = (req.query.end as string) ?? new Date().toISOString().slice(0, 10);
  const weather = await getStationSeries(ctx.stationId, new Date(start), new Date(end));
  if (weather.length === 0) throw ApiError.badRequest("No weather data found in the requested range");

  const events: Array<{ date: Date; grossDepthMm: number }> = await prisma.irrigationEvent.findMany({ where: { plantingId: ctx.planting.id } });
  const irrigationByDate = new Map(events.map((e) => [e.date.toISOString().slice(0, 10), e.grossDepthMm] as [string, number]));
  const series = simulatePlanting(weather, ctx.station, ctx.crop, ctx.soil, ctx.planting.plantingDate, irrigationByDate);

  const etcMm = series.reduce((s, d) => s + d.etc, 0);
  const unmetDeficit = series.reduce((s, d) => s + Math.max(d.depletionMm - d.ramMm, 0), 0);
  const etcAdjMm = Math.max(etcMm - unmetDeficit, 0);

  const result = calculateYieldResponse({ ky: ctx.crop.ky.total, etcMm, etcAdjMm });
  res.json({ ...result, etcMm: round(etcMm, 1), etcAdjMm: round(etcAdjMm, 1), start, end });
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
