/**
 * Runs the day-by-day simulation that backs the Farm Dashboard (Module
 * 13), the soil-moisture chart (Module 7) and the "next irrigation
 * date" projection.
 *
 * Effective rainfall is computed with the USDA method (Table 26) at
 * MONTHLY granularity — as the module's own Example 6 does — then
 * spread across that month's days in proportion to each day's share
 * of the month's rainfall, so daily totals sum back to the USDA
 * monthly figure exactly. This is a documented modelling simplification
 * (Module 4 does not provide a daily effective-rainfall method) rather
 * than an FAO equation of its own.
 */
import {
  calculateET0PenmanMonteith,
  calculateETc,
  currentGrowthStage,
  effectiveRainfallUSDA,
  kcForStage,
  rootDepthForStage,
  stepSoilWaterBalance,
  DailyMetRecord,
  CropDefinition,
  SoilProfile,
  StationConfig,
} from "@cwr/fao-engine";

export interface DailyBalancePoint {
  date: string;
  et0: number;
  kc: number;
  etc: number;
  rainMm: number;
  effectiveRainfallMm: number;
  irrigationAppliedMm: number;
  depletionMm: number;
  tamMm: number;
  ramMm: number;
  percentDepletion: number;
  irrigationNeeded: boolean;
  soilMoistureStatus: "adequate" | "stress-risk" | "deficit";
  stage: string;
  rootDepthM: number;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function simulatePlanting(
  weather: DailyMetRecord[],
  station: StationConfig,
  crop: CropDefinition,
  soil: SoilProfile,
  plantingDate: string,
  irrigationByDate: Map<string, number>
): DailyBalancePoint[] {
  // Pass 1: ET0/Kc/ETc and raw rainfall per day (weather already sorted by date).
  const raw = weather.map((day) => {
    const et0 = calculateET0PenmanMonteith(day, station).ET0;
    const { stage, dayInStage, stageLengthDays } = currentGrowthStage(crop, plantingDate, day.date);
    const kc = kcForStage(crop, stage, dayInStage, stageLengthDays);
    const rootDepthM = rootDepthForStage(crop, stage, dayInStage, stageLengthDays);
    const etc = calculateETc(et0, kc);
    return { date: day.date, et0, kc, etc, rainMm: day.rainMm, stage, rootDepthM };
  });

  // Pass 2: monthly USDA effective rainfall, spread proportionally across days.
  const byMonth = new Map<string, typeof raw>();
  for (const d of raw) {
    const k = monthKey(d.date);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(d);
  }
  const effectiveRainByDate = new Map<string, number>();
  for (const [, days] of byMonth) {
    const monthlyRain = days.reduce((s, d) => s + d.rainMm, 0);
    const monthlyEtc = days.reduce((s, d) => s + d.etc, 0);
    if (monthlyRain <= 0) {
      for (const d of days) effectiveRainByDate.set(d.date, 0);
      continue;
    }
    const { effectiveRainfallMm } = effectiveRainfallUSDA(monthlyRain, Math.max(monthlyEtc, 25));
    for (const d of days) {
      const share = d.rainMm / monthlyRain;
      effectiveRainByDate.set(d.date, round(effectiveRainfallMm * share, 2));
    }
  }

  // Pass 3: soil water balance walk, carrying depletion forward.
  let priorDepletion = 0;
  const out: DailyBalancePoint[] = [];
  for (const d of raw) {
    const irrigationAppliedMm = irrigationByDate.get(d.date) ?? 0;
    const balance = stepSoilWaterBalance({
      soil,
      rootDepthM: d.rootDepthM,
      allowableDepletionP: crop.allowableDepletionP,
      priorDepletionMm: priorDepletion,
      etcMm: d.etc,
      effectiveRainfallMm: effectiveRainByDate.get(d.date) ?? 0,
      irrigationAppliedMm,
    });
    priorDepletion = balance.depletionMm;
    out.push({
      date: d.date,
      et0: d.et0,
      kc: d.kc,
      etc: d.etc,
      rainMm: d.rainMm,
      effectiveRainfallMm: effectiveRainByDate.get(d.date) ?? 0,
      irrigationAppliedMm,
      depletionMm: balance.depletionMm,
      tamMm: balance.tamMm,
      ramMm: balance.ramMm,
      percentDepletion: balance.percentDepletion,
      irrigationNeeded: balance.irrigationNeeded,
      soilMoistureStatus: balance.soilMoistureStatus,
      stage: d.stage,
      rootDepthM: d.rootDepthM,
    });
  }
  return out;
}

/** Projects the next irrigation date forward from the last simulated
 * day, using the trailing 7-day mean ETc and assuming no further
 * rainfall (a conservative, worst-case estimate flagged as such to
 * the UI) until depletion reaches RAM. */
export function projectNextIrrigationDate(series: DailyBalancePoint[]): string | null {
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  if (last.irrigationNeeded) return last.date; // already due

  const trailing = series.slice(-7);
  const meanEtc = trailing.reduce((s, d) => s + d.etc, 0) / trailing.length;
  if (meanEtc <= 0) return null;

  const daysUntil = (last.ramMm - last.depletionMm) / meanEtc;
  const d = new Date(last.date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.ceil(daysUntil)));
  return d.toISOString().slice(0, 10);
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
