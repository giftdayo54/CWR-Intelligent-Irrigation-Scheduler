/**
 * Module 8: Effective rainfall.
 *
 * USDA method — Table 26 (Module 4, p.59, Source: FAO 1984): average
 * monthly effective rainfall as related to average monthly ETc and
 * mean monthly rainfall, assuming 75 mm net storage depth, with a
 * storage-factor correction table for other storage depths.
 * Bilinear interpolation is used between table nodes, matching the
 * module's own worked Example 6 ("interpolation from Table 26").
 */
import { EffectiveRainfallResult } from "./types";

const ETC_ROWS = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250];
const RAIN_COLS = [12.5, 25, 37.5, 50, 63, 75, 87.5, 100, 112.5, 125, 137.5, 150, 163, 175, 187.5, 200];

// TABLE_26[etcRowIndex][rainColIndex] = effective rainfall (mm), or null where Table 26 leaves the cell blank
// (i.e. that ETc/rainfall combination is outside the range FAO tabulated).
const TABLE_26: (number | null)[][] = [
  [8, 16, 24, null, null, null, null, null, null, null, null, null, null, null, null, null],
  [8, 17, 25, 32, 39, 46, null, null, null, null, null, null, null, null, null, null],
  [9, 18, 27, 34, 41, 48, 56, 62, 69, null, null, null, null, null, null, null],
  [9, 19, 28, 35, 43, 52, 59, 66, 73, 80, 87, 94, 100, null, null, null],
  [10, 20, 30, 37, 46, 54, 62, 70, 76, 85, 92, 98, 107, 116, 120, null],
  [10, 21, 31, 39, 49, 57, 66, 74, 81, 89, 97, 104, 112, 119, 127, 133],
  [11, 22, 32, 42, 52, 61, 69, 78, 86, 95, 103, 111, 118, 126, 134, 141],
  [11, 23, 33, 44, 54, 64, 73, 82, 91, 100, 109, 117, 125, 134, 142, 150],
  [12, 24, 35, 47, 57, 68, 78, 87, 96, 106, 115, 124, 132, 141, 150, 159],
  [13, 25, 38, 50, 61, 72, 84, 92, 102, 112, 121, 132, 140, 150, 158, 167],
];

// Storage correction factor (Table 26 footnote): default net storage = 75 mm -> factor 1.00
const STORAGE_MM = [20, 25, 37.5, 50, 62.5, 75, 100, 125, 150, 175, 200];
const STORAGE_FACTOR = [0.73, 0.77, 0.86, 0.93, 0.97, 1.0, 1.02, 1.04, 1.06, 1.07, 1.08];

function interp1(x: number, xs: number[], ys: (number | null)[]): number | null {
  const xc = Math.min(Math.max(x, xs[0]), xs[xs.length - 1]);
  for (let i = 0; i < xs.length - 1; i++) {
    if (xc >= xs[i] && xc <= xs[i + 1]) {
      const y0 = ys[i];
      const y1 = ys[i + 1];
      if (y0 == null || y1 == null) return y0 ?? y1 ?? null; // at the edge of tabulated data
      const f = (xc - xs[i]) / (xs[i + 1] - xs[i]);
      return y0 + (y1 - y0) * f;
    }
  }
  return ys[ys.length - 1];
}

function lookupBaseEffectiveRainfall(monthlyEtcMm: number, monthlyRainfallMm: number): number {
  const etcClamped = Math.min(Math.max(monthlyEtcMm, ETC_ROWS[0]), ETC_ROWS[ETC_ROWS.length - 1]);
  // interpolate each bounding ETc row across rainfall, then interpolate between the two rows
  let lo = 0;
  while (lo < ETC_ROWS.length - 2 && ETC_ROWS[lo + 1] < etcClamped) lo++;
  const hi = Math.min(lo + 1, ETC_ROWS.length - 1);
  const rLo = interp1(monthlyRainfallMm, RAIN_COLS, TABLE_26[lo]) ?? 0;
  const rHi = interp1(monthlyRainfallMm, RAIN_COLS, TABLE_26[hi]) ?? rLo;
  if (ETC_ROWS[hi] === ETC_ROWS[lo]) return rLo;
  const f = (etcClamped - ETC_ROWS[lo]) / (ETC_ROWS[hi] - ETC_ROWS[lo]);
  return rLo + (rHi - rLo) * f;
}

export function storageFactor(effectiveStorageMm: number): number {
  return interp1(effectiveStorageMm, STORAGE_MM, STORAGE_FACTOR) ?? 1.0;
}

/** USDA Soil Conservation Service method (Table 26). `storageMm` is the
 * net depth of water that can be effectively stored at time of
 * irrigation (Module 4 default assumption: 75 mm; pass the field's
 * actual readily-available moisture, RAM, for a site-specific figure —
 * see Example 6). */
export function effectiveRainfallUSDA(
  monthlyRainfallMm: number,
  monthlyETcMm: number,
  storageMm = 75
): EffectiveRainfallResult {
  const base = lookupBaseEffectiveRainfall(monthlyETcMm, monthlyRainfallMm);
  const factor = storageFactor(storageMm);
  const effectiveRainfallMm = round(base * factor, 1);
  const runoffLossMm = round(Math.max(monthlyRainfallMm - effectiveRainfallMm, 0), 1);
  const rainfallEfficiencyPct = monthlyRainfallMm > 0 ? round((effectiveRainfallMm / monthlyRainfallMm) * 100, 1) : 0;
  return {
    method: "usda",
    monthlyRainfallMm,
    monthlyETcMm,
    effectiveRainfallMm,
    storageFactor: round(factor, 3),
    rainfallEfficiencyPct,
    runoffLossMm,
  };
}

/** User-defined method: a flat efficiency fraction applied to rainfall,
 * for regions/users who prefer a locally calibrated percentage over
 * the USDA table. */
export function effectiveRainfallUserDefined(
  monthlyRainfallMm: number,
  monthlyETcMm: number,
  efficiencyFraction: number
): EffectiveRainfallResult {
  const effectiveRainfallMm = round(monthlyRainfallMm * efficiencyFraction, 1);
  return {
    method: "user-defined",
    monthlyRainfallMm,
    monthlyETcMm,
    effectiveRainfallMm,
    storageFactor: 1,
    rainfallEfficiencyPct: round(efficiencyFraction * 100, 1),
    runoffLossMm: round(monthlyRainfallMm - effectiveRainfallMm, 1),
  };
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
