/**
 * Module 11: Intelligent irrigation scheduler.
 *
 * Equation 28: IF = SMra / ETc = (SMta x P x RZD) / ETc
 * Irrigation depth, duration and volume follow the manual
 * calculation-sheet method used throughout Section 9.2 (e.g. Tables
 * 60-75): gross depth to refill the root zone to field capacity,
 * divided by the system's application rate, gives the contact time;
 * depth x area gives the volume.
 */
import { readilyAvailableMoisture } from "./soilWaterBalance";
import { SoilProfile } from "./types";

export interface IrrigationFrequencyInput {
  soil: SoilProfile;
  rootDepthM: number;
  allowableDepletionP: number;
  etcMmPerDay: number;
}

/** Equation 28: Irrigation frequency (days). */
export function irrigationFrequencyDays(input: IrrigationFrequencyInput): number {
  const ramMm = readilyAvailableMoisture(input.soil, input.rootDepthM, input.allowableDepletionP);
  if (input.etcMmPerDay <= 0) return Infinity;
  return round(ramMm / input.etcMmPerDay, 1);
}

export interface IrrigationEventPlan {
  netDepthMm: number; // = RAM, the depth needed to refill the root zone to field capacity
  grossDepthMm: number; // netDepthMm / system efficiency
  durationHours: number;
  volumeM3: number;
  frequencyDays: number;
}

/**
 * Builds one irrigation-event plan (depth/duration/volume) for a field.
 * `applicationRateMmPerHour` is the system's delivery rate (sprinkler
 * precipitation rate, drip emitter rate averaged over wetted area, or
 * furrow/border intake rate) — a design input the user supplies per
 * system, consistent with the manual schedule examples in Section 9.2.
 */
export function planIrrigationEvent(
  frequencyInput: IrrigationFrequencyInput,
  systemEfficiency: number,
  applicationRateMmPerHour: number,
  areaHa: number
): IrrigationEventPlan {
  const netDepthMm = readilyAvailableMoisture(frequencyInput.soil, frequencyInput.rootDepthM, frequencyInput.allowableDepletionP);
  const grossDepthMm = round(netDepthMm / systemEfficiency, 1);
  const durationHours = applicationRateMmPerHour > 0 ? round(grossDepthMm / applicationRateMmPerHour, 2) : 0;
  const volumeM3 = round((grossDepthMm / 1000) * areaHa * 10000, 1);
  return {
    netDepthMm: round(netDepthMm, 1),
    grossDepthMm,
    durationHours,
    volumeM3,
    frequencyDays: irrigationFrequencyDays(frequencyInput),
  };
}

export interface ScheduleEntry {
  date: string;
  netDepthMm: number;
  grossDepthMm: number;
  durationHours: number;
  volumeM3: number;
}

/**
 * Generates a full-season irrigation calendar by walking a daily ETc
 * series and triggering an event whenever accumulated depletion
 * reaches RAM (CROPWAT "Option 2" logic referenced in Section 9.2.4 —
 * the most common scheduling rule, irrigate at 100% RAM depletion).
 */
export function generateSeasonSchedule(
  dailyEtc: Array<{ date: string; etcMm: number; effectiveRainfallMm?: number }>,
  soil: SoilProfile,
  rootDepthByDate: (date: string) => number,
  allowableDepletionP: number,
  systemEfficiency: number,
  applicationRateMmPerHour: number,
  areaHa: number
): ScheduleEntry[] {
  const events: ScheduleEntry[] = [];
  let depletion = 0;
  for (const day of dailyEtc) {
    const rootDepthM = rootDepthByDate(day.date);
    const ramMm = readilyAvailableMoisture(soil, rootDepthM, allowableDepletionP);
    depletion += day.etcMm - (day.effectiveRainfallMm ?? 0);
    if (depletion < 0) depletion = 0;
    if (depletion >= ramMm) {
      const grossDepthMm = round(depletion / systemEfficiency, 1);
      const durationHours = applicationRateMmPerHour > 0 ? round(grossDepthMm / applicationRateMmPerHour, 2) : 0;
      const volumeM3 = round((grossDepthMm / 1000) * areaHa * 10000, 1);
      events.push({ date: day.date, netDepthMm: round(depletion, 1), grossDepthMm, durationHours, volumeM3 });
      depletion = 0; // refilled to field capacity
    }
  }
  return events;
}

/** Rolls a season schedule up to weekly / monthly totals for the
 * summary views (Section 9.2.2's "Summary irrigation schedule"). */
export function summarizeSchedule(events: ScheduleEntry[], bucketBy: "week" | "month"): Array<{ bucket: string; totalNetMm: number; totalGrossMm: number; totalVolumeM3: number; eventCount: number }> {
  const buckets = new Map<string, ScheduleEntry[]>();
  for (const e of events) {
    const key = bucketBy === "month" ? e.date.slice(0, 7) : isoWeekKey(e.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([bucket, evs]) => ({
      bucket,
      totalNetMm: round(evs.reduce((s, e) => s + e.netDepthMm, 0), 1),
      totalGrossMm: round(evs.reduce((s, e) => s + e.grossDepthMm, 0), 1),
      totalVolumeM3: round(evs.reduce((s, e) => s + e.volumeM3, 0), 1),
      eventCount: evs.length,
    }));
}

function isoWeekKey(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00Z");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
