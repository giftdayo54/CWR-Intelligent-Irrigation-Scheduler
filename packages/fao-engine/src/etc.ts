/** Module 6: Crop evapotranspiration. ETc = ET0 x Kc. */
export function calculateETc(et0MmPerDay: number, kc: number): number {
  return round(et0MmPerDay * kc, 2);
}

export interface DailyEtcPoint {
  date: string;
  et0: number;
  kc: number;
  etc: number;
}

export function aggregateEtc(points: DailyEtcPoint[]): { totalEtcMm: number; meanEtcMmPerDay: number; days: number } {
  const totalEtcMm = points.reduce((s, p) => s + p.etc, 0);
  return {
    totalEtcMm: round(totalEtcMm, 1),
    meanEtcMmPerDay: points.length ? round(totalEtcMm / points.length, 2) : 0,
    days: points.length,
  };
}

/** Groups daily ETc points into ISO week (YYYY-Www) buckets. */
export function weeklyEtc(points: DailyEtcPoint[]): Array<{ week: string; totalEtcMm: number; meanEtcMmPerDay: number }> {
  const buckets = new Map<string, DailyEtcPoint[]>();
  for (const p of points) {
    const key = isoWeekKey(p.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, pts]) => ({ week, ...aggregateEtcShort(pts) }));
}

/** Groups daily ETc points into calendar-month (YYYY-MM) buckets. */
export function monthlyEtc(points: DailyEtcPoint[]): Array<{ month: string; totalEtcMm: number; meanEtcMmPerDay: number }> {
  const buckets = new Map<string, DailyEtcPoint[]>();
  for (const p of points) {
    const key = p.date.slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, pts]) => ({ month, ...aggregateEtcShort(pts) }));
}

function aggregateEtcShort(pts: DailyEtcPoint[]) {
  const { totalEtcMm, meanEtcMmPerDay } = aggregateEtc(pts);
  return { totalEtcMm, meanEtcMmPerDay };
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
