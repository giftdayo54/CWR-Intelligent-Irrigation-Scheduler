/**
 * Typical total available soil moisture (SMta = FC - PWP, mm/m) by
 * texture class.
 *
 * Module 4 Chapter 7 discusses soil texture and water-holding capacity
 * qualitatively and states repeatedly that SMta "is usually determined
 * through laboratory analysis" (Section 9.2) rather than tabulating a
 * definitive FC/PWP-by-texture table itself. The figures below are the
 * standard published ranges commonly used as a starting point in the
 * absence of lab data (consistent in order of magnitude with the
 * worked examples elsewhere in Module 4: ~100 mm/m for a "light soil",
 * ~140-160 mm/m for clay/heavy-textured soils). Always prefer a
 * lab-measured `SoilProfile.totalAvailableMoistureMmPerM` when
 * available — every consumer of this table checks for that override
 * first (see soilWaterBalance.ts).
 */
import { SoilTexture } from "./types";

export const SOIL_TEXTURE_AWC_MM_PER_M: Record<SoilTexture, { min: number; typical: number; max: number }> = {
  sand: { min: 60, typical: 80, max: 100 },
  "loamy-sand": { min: 100, typical: 115, max: 150 },
  "sandy-loam": { min: 125, typical: 140, max: 175 },
  loam: { min: 150, typical: 170, max: 190 },
  "clay-loam": { min: 170, typical: 190, max: 220 },
  clay: { min: 190, typical: 210, max: 230 },
};

export function totalAvailableMoisture(texture: SoilTexture): number {
  return SOIL_TEXTURE_AWC_MM_PER_M[texture].typical;
}
