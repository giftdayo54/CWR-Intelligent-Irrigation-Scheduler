import { describe, it, expect } from "vitest";
import { irrigationFrequencyDays } from "../src/irrigationScheduler";
import { grossIrrigationRequirement, netIrrigationRequirement } from "../src/irrigationRequirement";
import { effectiveRainfallUSDA } from "../src/effectiveRainfall";
import { SoilProfile } from "../src/types";

describe("Irrigation frequency (Equation 28) vs. Module 4 worked examples", () => {
  it("Example 13 (onions): SMta=140mm/m, RZD=0.45m, P=0.5, ETc=3.86mm/day -> ~8.16 days", () => {
    const soil: SoilProfile = { texture: "loam", fieldCapacity: 0, permanentWiltingPoint: 0, totalAvailableMoistureMmPerM: 140 };
    const days = irrigationFrequencyDays({ soil, rootDepthM: 0.45, allowableDepletionP: 0.5, etcMmPerDay: 3.86 });
    expect(days).toBeCloseTo(8.16, 1);
  });

  it("Example 14 (maize): SMta=100mm/m, RZD=1m, P=0.5, ETc=5mm/day -> exactly 10 days", () => {
    const soil: SoilProfile = { texture: "loam", fieldCapacity: 0, permanentWiltingPoint: 0, totalAvailableMoistureMmPerM: 100 };
    const days = irrigationFrequencyDays({ soil, rootDepthM: 1.0, allowableDepletionP: 0.5, etcMmPerDay: 5 });
    expect(days).toBeCloseTo(10, 5);
  });

  it("Example 15 (maize, pressurized system): RZD reduced to 0.75m -> exactly 7.5 days", () => {
    const soil: SoilProfile = { texture: "loam", fieldCapacity: 0, permanentWiltingPoint: 0, totalAvailableMoistureMmPerM: 100 };
    const days = irrigationFrequencyDays({ soil, rootDepthM: 0.75, allowableDepletionP: 0.5, etcMmPerDay: 5 });
    expect(days).toBeCloseTo(7.5, 5);
  });
});

describe("Gross irrigation requirement (Equation 25) vs. Table 31 (maize, Kutsaga)", () => {
  it("November: IRn=102.1mm -> surface 226.9mm, sprinkler 136.1mm", () => {
    expect(grossIrrigationRequirement(102.1, "surface")).toBeCloseTo(226.9, 0);
    expect(grossIrrigationRequirement(102.1, "sprinkler")).toBeCloseTo(136.1, 0);
  });

  it("December: IRn=80.7mm -> surface 179.3mm, sprinkler 107.6mm", () => {
    expect(grossIrrigationRequirement(80.7, "surface")).toBeCloseTo(179.3, 0);
    expect(grossIrrigationRequirement(80.7, "sprinkler")).toBeCloseTo(107.6, 0);
  });
});

describe("Net irrigation requirement (Equation 20)", () => {
  it("reduces to ETc - Pe when Ge, Wb and LR are all zero", () => {
    const irn = netIrrigationRequirement({ etcMm: 145.0, effectiveRainfallMm: 94.5 });
    expect(irn).toBeCloseTo(50.5, 5);
  });

  it("never returns a negative requirement (surplus rainfall carries no credit forward here)", () => {
    const irn = netIrrigationRequirement({ etcMm: 20, effectiveRainfallMm: 50 });
    expect(irn).toBe(0);
  });
});

describe("Effective rainfall, USDA method (Table 26) vs. Module 4 Example 6", () => {
  it("135mm rainfall, 145mm ETc, 75mm storage -> ~94.5mm effective rainfall", () => {
    const result = effectiveRainfallUSDA(135, 145, 75);
    expect(Math.abs(result.effectiveRainfallMm - 94.5)).toBeLessThan(1.5);
  });

  it("applies the storage correction factor for a smaller storage depth (Example 6: 60mm -> factor 0.958)", () => {
    const at75 = effectiveRainfallUSDA(135, 145, 75);
    const at60 = effectiveRainfallUSDA(135, 145, 60);
    expect(at60.storageFactor).toBeLessThan(at75.storageFactor);
    expect(at60.storageFactor).toBeCloseTo(0.958, 1);
  });
});
