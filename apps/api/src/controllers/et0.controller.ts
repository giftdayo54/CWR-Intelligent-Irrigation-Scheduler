import { Request, Response } from "express";
import { z } from "zod";
import { calculateET0ClassAPan, calculateET0PenmanMonteith } from "@cwr/fao-engine";
import type { KpHumidityClass, KpSiting, KpWindClass } from "@cwr/fao-engine";

const pmSchema = z.object({
  date: z.string(),
  latitudeDeg: z.number().min(-90).max(90),
  elevationM: z.number(),
  anemometerHeightM: z.number().positive().default(2),
  maxTemperatureC: z.number(),
  minTemperatureC: z.number(),
  rhMaxPct: z.number().min(0).max(100).optional(),
  rhMinPct: z.number().min(0).max(100).optional(),
  windRunKmDay: z.number().min(0).optional(),
  sunHours: z.number().min(0).max(24).optional(),
  radiationMJm2: z.number().min(0).optional(),
});

/** POST /api/et0/penman-monteith — Module 1.A, the standalone
 * calculator (not tied to a stored weather station). Returns the full
 * "Equation Breakdown" / "Intermediate Results" the UI displays. */
export function calculatePenmanMonteith(req: Request, res: Response) {
  const input = pmSchema.parse(req.body);
  const breakdown = calculateET0PenmanMonteith(
    {
      date: input.date,
      maxTemperatureC: input.maxTemperatureC,
      minTemperatureC: input.minTemperatureC,
      rhMaxPct: input.rhMaxPct,
      rhMinPct: input.rhMinPct,
      windRunKmDay: input.windRunKmDay,
      sunHours: input.sunHours,
      radiationMJm2: input.radiationMJm2,
      rainMm: 0,
    },
    {
      name: "manual-entry",
      latitudeDeg: input.latitudeDeg,
      longitudeDeg: 0,
      elevationM: input.elevationM,
      anemometerHeightM: input.anemometerHeightM,
    }
  );
  res.json(breakdown);
}

function bucketWindClass(windSpeedMs: number): KpWindClass {
  if (windSpeedMs < 2) return "light";
  if (windSpeedMs < 5) return "moderate";
  if (windSpeedMs < 8) return "strong";
  return "very-strong";
}

function bucketHumidityClass(rhPct: number): KpHumidityClass {
  if (rhPct < 40) return "low";
  if (rhPct <= 70) return "medium";
  return "high";
}

const panSchema = z.object({
  date: z.string(),
  epanMm: z.number().positive(),
  siting: z.enum(["case-a-green-crop", "case-b-dry-fallow"]).default("case-a-green-crop"),
  fetchM: z.number().positive().default(100),
  windSpeedMs: z.number().min(0),
  rhPct: z.number().min(0).max(100),
});

/** POST /api/et0/class-a-pan — Module 1.B: ET0 = Kp x Epan. */
export function calculateClassAPan(req: Request, res: Response) {
  const input = panSchema.parse(req.body);
  const breakdown = calculateET0ClassAPan(
    input.date,
    input.epanMm,
    input.siting as KpSiting,
    input.fetchM,
    bucketWindClass(input.windSpeedMs),
    bucketHumidityClass(input.rhPct)
  );
  res.json(breakdown);
}
