/**
 * Module 9: Net Irrigation Requirement — Equation 20:
 *   IRn = ETc - (Pe + Ge + Wb) + LR
 *
 * Module 10: Gross Irrigation Requirement — Equation 25:
 *   IRg = IRn / E
 * Default overall efficiencies from Table 30: Surface 45%, Sprinkler
 * 75%, Localized/drip 90%.
 *
 * Leaching requirement — Equations 21/23/24 (used only when the user
 * supplies water/soil salinity data; otherwise LR = 0).
 */
import { IrrigationSystem, NetIrrigationRequirementInput } from "./types";

export const DEFAULT_IRRIGATION_EFFICIENCY: Record<IrrigationSystem, number> = {
  surface: 0.45,
  sprinkler: 0.75,
  drip: 0.9, // "Localized" in Table 30
};

/** Equation 21: leaching requirement fraction, for surface/sprinkler
 * irrigation, from water and soil salinity (ECw, ECe) and leaching
 * efficiency (Le, default 100% i.e. no inefficiency adjustment). */
export function leachingRequirementFraction(ecwDsPerM: number, eceDsPerM: number, leachingEfficiency = 1): number {
  if (eceDsPerM <= ecwDsPerM / 5) return 1; // guard: denominator would be <= 0
  return (ecwDsPerM / (5 * eceDsPerM - ecwDsPerM)) * (1 / leachingEfficiency);
}

/** Equation 24: LR (mm) = ETc / (1 - LR fraction) - ETc */
export function leachingRequirementMm(etcMm: number, leachingRequirementFractionValue: number): number {
  const f = Math.min(Math.max(leachingRequirementFractionValue, 0), 0.95);
  return round((etcMm / (1 - f)) - etcMm, 2);
}

/** Equation 20: Net Irrigation Requirement (mm). */
export function netIrrigationRequirement(input: NetIrrigationRequirementInput): number {
  const { etcMm, effectiveRainfallMm, groundwaterContributionMm = 0, soilWaterContributionMm = 0, leachingRequirementMm: lr = 0 } = input;
  const irn = etcMm - (effectiveRainfallMm + groundwaterContributionMm + soilWaterContributionMm) + lr;
  return round(Math.max(irn, 0), 2);
}

/** Equation 25: Gross Irrigation Requirement (mm) = IRn / E. */
export function grossIrrigationRequirement(irnMm: number, system: IrrigationSystem, efficiencyOverride?: number): number {
  const efficiency = efficiencyOverride ?? DEFAULT_IRRIGATION_EFFICIENCY[system];
  if (efficiency <= 0) throw new Error("Irrigation efficiency must be > 0");
  return round(irnMm / efficiency, 2);
}

export interface GrossIrrigationBySystem {
  surface: number;
  sprinkler: number;
  drip: number;
}

/** Convenience: gross irrigation requirement for all three systems at
 * once (Table 31 lays results out side by side for comparison). */
export function grossIrrigationRequirementAllSystems(irnMm: number): GrossIrrigationBySystem {
  return {
    surface: grossIrrigationRequirement(irnMm, "surface"),
    sprinkler: grossIrrigationRequirement(irnMm, "sprinkler"),
    drip: grossIrrigationRequirement(irnMm, "drip"),
  };
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
