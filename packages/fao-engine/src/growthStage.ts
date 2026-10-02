/**
 * Smart growth-stage engine, dynamic Kc curve and root-growth model.
 *
 * Growth stage and Kc/root depth are DERIVED from planting date + crop
 * — never manually selected by the user, per spec. Construction follows
 * Module 4, Section 4.6 exactly:
 *   - Horizontal line at Kc ini through the initial stage
 *   - Diagonal Kc ini -> Kc mid through the development stage
 *   - Horizontal line at Kc mid through the mid-season stage
 *   - Diagonal Kc mid -> Kc end through the late-season stage
 *
 * Root depth follows the same "flat / ramp / flat / flat" shape used in
 * the worked example the app's own spec gives (0.15 m constant through
 * initial, ramps to the maximum through development, holds at maximum
 * through mid-season and late season) — root system does not retract
 * once established.
 */
import { CropDefinition, GrowthStage, GrowthStageResult } from "./types";

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

export function daysAfterPlanting(plantingDate: string, currentDate: string): number {
  return daysBetween(plantingDate, currentDate);
}

interface StageWindow {
  stage: GrowthStage;
  startDay: number; // inclusive, 0-indexed from planting (day of planting = day 0)
  endDay: number; // exclusive
}

export function stageWindows(crop: CropDefinition): StageWindow[] {
  const { initial, development, mid, late } = crop.stageLengthsDays;
  let cursor = 0;
  const windows: StageWindow[] = [];
  for (const [stage, length] of [
    ["initial", initial],
    ["development", development],
    ["mid", mid],
    ["late", late],
  ] as [GrowthStage, number][]) {
    windows.push({ stage, startDay: cursor, endDay: cursor + length });
    cursor += length;
  }
  return windows;
}

/** Module 3: determine DAP, current stage, day-in-stage and stage length. */
export function currentGrowthStage(
  crop: CropDefinition,
  plantingDate: string,
  currentDate: string
): { dap: number; stage: GrowthStage; dayInStage: number; stageLengthDays: number } {
  const dap = daysAfterPlanting(plantingDate, currentDate);
  const totalSeason = Object.values(crop.stageLengthsDays).reduce((a, b) => a + b, 0);
  if (dap < 0) {
    return { dap, stage: "initial", dayInStage: 0, stageLengthDays: crop.stageLengthsDays.initial };
  }
  if (dap >= totalSeason) {
    return { dap, stage: "harvested", dayInStage: dap - totalSeason, stageLengthDays: 0 };
  }
  const windows = stageWindows(crop);
  const w = windows.find((win) => dap >= win.startDay && dap < win.endDay)!;
  return { dap, stage: w.stage, dayInStage: dap - w.startDay, stageLengthDays: w.endDay - w.startDay };
}

/** Module 4: Kc for the given day-in-stage, per the crop's stage. */
export function kcForStage(crop: CropDefinition, stage: GrowthStage, dayInStage: number, stageLengthDays: number): number {
  switch (stage) {
    case "initial":
      return crop.kcIni;
    case "development":
      return interpolate(crop.kcIni, crop.kcMid, dayInStage, stageLengthDays);
    case "mid":
      return crop.kcMid;
    case "late":
      return interpolate(crop.kcMid, crop.kcEnd, dayInStage, stageLengthDays);
    case "harvested":
      return crop.kcEnd;
  }
}

/** Module 5: root depth for the given day-in-stage, per the crop's stage. */
export function rootDepthForStage(
  crop: CropDefinition,
  stage: GrowthStage,
  dayInStage: number,
  stageLengthDays: number
): number {
  switch (stage) {
    case "initial":
      return crop.rootDepthMinM;
    case "development":
      return interpolate(crop.rootDepthMinM, crop.rootDepthMaxM, dayInStage, stageLengthDays);
    case "mid":
    case "late":
    case "harvested":
      return crop.rootDepthMaxM;
  }
}

/** Generic linear interpolation matching the spec's stated formula:
 * value = start + ((end - start) * dayInStage / stageLength) */
function interpolate(start: number, end: number, dayInStage: number, stageLengthDays: number): number {
  if (stageLengthDays <= 0) return end;
  const fraction = Math.min(Math.max(dayInStage / stageLengthDays, 0), 1);
  return start + (end - start) * fraction;
}

/** Table 54 footnote 2: P applies at ETc ~= 5 mm/day; adjust for other
 * ETc levels via P = P(table) + 0.04 x (5 - ETc), clamped to [0.1, 0.8]
 * (FAO-56 guidance range) so extreme ETc values cannot produce a
 * nonsensical depletion fraction. */
export function adjustAllowableDepletionForETc(pTable: number, etcMmPerDay: number): number {
  const adjusted = pTable + 0.04 * (5 - etcMmPerDay);
  return Math.min(0.8, Math.max(0.1, adjusted));
}

/** One-call convenience wrapping Modules 3-5 together, matching the
 * "Farm Dashboard" widget fields (Module 13). */
export function growthStageSummary(crop: CropDefinition, plantingDate: string, currentDate: string): GrowthStageResult {
  const { dap, stage, dayInStage, stageLengthDays } = currentGrowthStage(crop, plantingDate, currentDate);
  const kc = kcForStage(crop, stage, dayInStage, stageLengthDays);
  const rootDepthM = rootDepthForStage(crop, stage, dayInStage, stageLengthDays);
  return {
    date: currentDate,
    daysAfterPlanting: dap,
    stage,
    dayInStage,
    stageLengthDays,
    kc: round(kc, 3),
    rootDepthM: round(rootDepthM, 3),
    allowableDepletionP: crop.allowableDepletionP,
  };
}

/** Builds a full daily Kc + root-depth series across the growing season,
 * for the Kc-curve chart and growth timeline (Modules 4 and 12). */
export function buildSeasonSeries(
  crop: CropDefinition,
  plantingDate: string
): Array<{ date: string; dap: number; stage: GrowthStage; kc: number; rootDepthM: number }> {
  const totalSeason = Object.values(crop.stageLengthsDays).reduce((a, b) => a + b, 0);
  const out: Array<{ date: string; dap: number; stage: GrowthStage; kc: number; rootDepthM: number }> = [];
  const start = new Date(plantingDate + "T00:00:00Z");
  for (let dap = 0; dap <= totalSeason; dap++) {
    const d = new Date(start.getTime() + dap * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const { stage, dayInStage, stageLengthDays } = currentGrowthStage(crop, plantingDate, iso);
    out.push({
      date: iso,
      dap,
      stage,
      kc: round(kcForStage(crop, stage, dayInStage, stageLengthDays), 3),
      rootDepthM: round(rootDepthForStage(crop, stage, dayInStage, stageLengthDays), 3),
    });
  }
  return out;
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
