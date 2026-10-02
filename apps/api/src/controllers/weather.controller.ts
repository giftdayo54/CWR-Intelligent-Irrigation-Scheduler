import { Request, Response } from "express";
import { z } from "zod";
import { parseMetWorkbook } from "@cwr/fao-engine";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";

async function assertStationOwnership(stationId: string, userId: string) {
  const station = await prisma.weatherStation.findFirst({ where: { id: stationId, farm: { userId } } });
  if (!station) throw ApiError.notFound("Weather station not found");
}

/**
 * POST /api/weather/:stationId/import — accepts a MET_DATA.xlsx-shaped
 * workbook (multipart field "file"), parses it with the exact Nchalo
 * Factory column structure, and upserts one DailyWeather row per day.
 */
export async function importMetWorkbook(req: Request, res: Response) {
  const stationId = req.params.stationId;
  await assertStationOwnership(stationId, req.user!.userId);
  if (!req.file) throw ApiError.badRequest('No file uploaded (expected multipart field "file")');

  const parsed = parseMetWorkbook(req.file.buffer);

  let upsertedCount = 0;
  const flaggedRows: Array<{ date: string; flags: string[] }> = [];

  for (const rec of parsed.records) {
    const data = {
      stationId,
      date: new Date(rec.date + "T00:00:00.000Z"),
      maxTemperatureC: rec.maxTemperatureC,
      minTemperatureC: rec.minTemperatureC,
      rhMaxPct: rec.rhMaxPct ?? null,
      rhMinPct: rec.rhMinPct ?? null,
      dryBulb08C: rec.dryBulb08C ?? null,
      dryBulb14C: rec.dryBulb14C ?? null,
      wetBulb08C: rec.wetBulb08C ?? null,
      wetBulb14C: rec.wetBulb14C ?? null,
      maxResetC: rec.maxResetC ?? null,
      minResetC: rec.minResetC ?? null,
      grassMinC: rec.grassMinC ?? null,
      temp08C: rec.temp08C ?? null,
      rh08Pct: rec.rh08Pct ?? null,
      temp14C: rec.temp14C ?? null,
      rh14Pct: rec.rh14Pct ?? null,
      etStationMm: rec.etStationMm ?? null,
      rainMm: rec.rainMm,
      radiationMJm2: rec.radiationMJm2 ?? null,
      sunHours: rec.sunHours ?? null,
      noDips: rec.noDips ?? null,
      classAPanMm: rec.classAPanMm ?? null,
      windRunKmDay: rec.windRunKmDay ?? null,
      anemometerReading: rec.anemometerReading ?? null,
      soilTemp5cm08C: rec.soilTemp5cm08C ?? null,
      soilTemp10cm08C: rec.soilTemp10cm08C ?? null,
      soilTemp20cm08C: rec.soilTemp20cm08C ?? null,
      soilTemp100cm08C: rec.soilTemp100cm08C ?? null,
      soilTemp5cm14C: rec.soilTemp5cm14C ?? null,
      soilTemp10cm14C: rec.soilTemp10cm14C ?? null,
      soilTemp20cm14C: rec.soilTemp20cm14C ?? null,
      soilTemp100cm14C: rec.soilTemp100cm14C ?? null,
      flags: rec.flags ?? [],
    };

    await prisma.dailyWeather.upsert({
      where: { stationId_date: { stationId, date: data.date } },
      create: data,
      update: data,
    });
    upsertedCount++;

    if (rec.flags?.length) flaggedRows.push({ date: rec.date, flags: rec.flags });
  }

  res.status(201).json({
    stationNameFromTitle: parsed.stationNameFromTitle,
    periodStartFromTitle: parsed.periodStartFromTitle,
    periodEndFromTitle: parsed.periodEndFromTitle,
    rowsParsed: parsed.records.length,
    rowsSkipped: parsed.skippedRowCount,
    upserted: upsertedCount,
    flaggedRows: flaggedRows.slice(0, 50), // cap payload size; full flags remain on each stored row
    flaggedRowCount: flaggedRows.length,
  });
}

const manualEntrySchema = z.object({
  date: z.string(),
  maxTemperatureC: z.number(),
  minTemperatureC: z.number(),
  rhMaxPct: z.number().optional(),
  rhMinPct: z.number().optional(),
  rainMm: z.number().default(0),
  radiationMJm2: z.number().optional(),
  sunHours: z.number().optional(),
  windRunKmDay: z.number().optional(),
  classAPanMm: z.number().optional(),
});

/** POST /api/weather/:stationId/manual — for stations without a
 * spreadsheet export, e.g. a farmer logging a rain-gauge/thermometer
 * reading by hand. */
export async function manualEntry(req: Request, res: Response) {
  const stationId = req.params.stationId;
  await assertStationOwnership(stationId, req.user!.userId);
  const input = manualEntrySchema.parse(req.body);
  const { date: rawDate, ...rest } = input;
  const date = new Date(rawDate + "T00:00:00.000Z");
  const row = await prisma.dailyWeather.upsert({
    where: { stationId_date: { stationId, date } },
    create: { stationId, date, ...rest },
    update: { ...rest },
  });
  res.status(201).json(row);
}

/** GET /api/weather/:stationId?start=...&end=... */
export async function getSeries(req: Request, res: Response) {
  const stationId = req.params.stationId;
  await assertStationOwnership(stationId, req.user!.userId);
  const start = req.query.start ? new Date(req.query.start as string) : new Date("1900-01-01");
  const end = req.query.end ? new Date(req.query.end as string) : new Date("2100-01-01");
  const rows = await prisma.dailyWeather.findMany({
    where: { stationId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  res.json(rows);
}
