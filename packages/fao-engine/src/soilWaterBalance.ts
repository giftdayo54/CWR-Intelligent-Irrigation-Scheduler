/**
 * Module 7: Soil water balance.
 *
 * TAM (Total Available Moisture) = SMta x RZD, where SMta is the
 * soil's available-water-holding capacity (mm/m) — Section 7.6 /
 * Equation 26's SMta = FC - PWP (mm/m).
 * RAM (Readily Available Moisture) = TAM x P — Equation 26 exactly
 * (SMra = P x SMta, expressed here per unit root depth already
 * applied, i.e. SMra = P x SMta x RZD).
 */
import { SoilProfile } from "./types";
import { totalAvailableMoisture } from "./soilTextures";

export function smtaMmPerM(soil: SoilProfile): number {
  if (soil.totalAvailableMoistureMmPerM != null) return soil.totalAvailableMoistureMmPerM;
  return totalAvailableMoisture(soil.texture);
}

/** Total Available Moisture in the current root zone (mm). */
export function totalAvailableMoistureInRootZone(soil: SoilProfile, rootDepthM: number): number {
  return round(smtaMmPerM(soil) * rootDepthM, 1);
}

/** Equation 26: Readily Available Moisture (mm) = P x SMta x RZD. */
export function readilyAvailableMoisture(soil: SoilProfile, rootDepthM: number, allowableDepletionP: number): number {
  return round(smtaMmPerM(soil) * rootDepthM * allowableDepletionP, 1);
}

export interface SoilWaterBalanceInputs {
  soil: SoilProfile;
  rootDepthM: number;
  allowableDepletionP: number;
  /** Root-zone depletion carried over from the previous day (mm, >= 0) */
  priorDepletionMm: number;
  etcMm: number;
  effectiveRainfallMm: number;
  irrigationAppliedMm: number;
}

export interface SoilWaterBalanceResult {
  tamMm: number;
  ramMm: number;
  depletionMm: number; // Dr: how much of TAM has been used up, 0 = at field capacity
  percentDepletion: number; // depletion / TAM * 100
  deepPercolationMm: number; // excess above field capacity, lost below the root zone
  irrigationNeeded: boolean; // true once depletion exceeds RAM
  soilMoistureStatus: "adequate" | "stress-risk" | "deficit";
}

/** Advances the soil-water bucket by one day (Module 7/9 combined: the
 * daily accounting that underlies the "Current Soil Moisture" dashboard
 * field and the irrigation-needed trigger). */
export function stepSoilWaterBalance(input: SoilWaterBalanceInputs): SoilWaterBalanceResult {
  const tamMm = totalAvailableMoistureInRootZone(input.soil, input.rootDepthM);
  const ramMm = readilyAvailableMoisture(input.soil, input.rootDepthM, input.allowableDepletionP);

  let depletion =
    input.priorDepletionMm + input.etcMm - input.effectiveRainfallMm - input.irrigationAppliedMm;

  let deepPercolationMm = 0;
  if (depletion < 0) {
    deepPercolationMm = round(-depletion, 1); // water applied beyond field capacity is lost
    depletion = 0;
  }
  if (depletion > tamMm) depletion = tamMm; // cannot deplete below permanent wilting point

  const percentDepletion = tamMm > 0 ? round((depletion / tamMm) * 100, 1) : 0;
  const irrigationNeeded = depletion >= ramMm;

  let soilMoistureStatus: SoilWaterBalanceResult["soilMoistureStatus"] = "adequate";
  if (depletion >= tamMm * 0.95) soilMoistureStatus = "deficit";
  else if (irrigationNeeded) soilMoistureStatus = "stress-risk";

  return {
    tamMm,
    ramMm,
    depletionMm: round(depletion, 1),
    percentDepletion,
    deepPercolationMm,
    irrigationNeeded,
    soilMoistureStatus,
  };
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
