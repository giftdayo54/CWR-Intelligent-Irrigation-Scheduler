import { describe, it, expect } from "vitest";
import { currentGrowthStage, kcForStage, rootDepthForStage, growthStageSummary } from "../src/growthStage";
import { CropDefinition } from "../src/types";

// Synthetic crop with round-number stage lengths, so the Kc-curve
// interpolation (Module 4, Section 4.6) can be checked against
// hand-computed expected values.
const testCrop: CropDefinition = {
  id: "test-crop",
  name: "Test Crop",
  category: "test",
  kcIni: 0.3,
  kcMid: 1.2,
  kcEnd: 0.6,
  stageLengthsDays: { initial: 20, development: 30, mid: 40, late: 30 },
  rootDepthMinM: 0.2,
  rootDepthMaxM: 1.0,
  allowableDepletionP: 0.5,
};

describe("Growth stage determination (Module 3) matches the maize worked example in the spec", () => {
  it("DAP 66 with stages 20/35/40/30 falls in mid-season", () => {
    const cropLikeSpecExample: CropDefinition = {
      ...testCrop,
      stageLengthsDays: { initial: 20, development: 35, mid: 40, late: 30 },
    };
    const result = currentGrowthStage(cropLikeSpecExample, "2026-10-15", "2026-12-20");
    expect(result.dap).toBe(66);
    expect(result.stage).toBe("mid");
  });
});

describe("Kc curve construction (Module 4, Section 4.6)", () => {
  it("is flat at Kc ini through the whole initial stage", () => {
    expect(kcForStage(testCrop, "initial", 0, 20)).toBeCloseTo(0.3, 5);
    expect(kcForStage(testCrop, "initial", 19, 20)).toBeCloseTo(0.3, 5);
  });

  it("is a straight diagonal from Kc ini to Kc mid across the development stage", () => {
    expect(kcForStage(testCrop, "development", 0, 30)).toBeCloseTo(0.3, 5);
    expect(kcForStage(testCrop, "development", 15, 30)).toBeCloseTo(0.75, 5); // midpoint
    expect(kcForStage(testCrop, "development", 30, 30)).toBeCloseTo(1.2, 5);
  });

  it("is flat at Kc mid through the whole mid-season stage", () => {
    expect(kcForStage(testCrop, "mid", 0, 40)).toBeCloseTo(1.2, 5);
    expect(kcForStage(testCrop, "mid", 39, 40)).toBeCloseTo(1.2, 5);
  });

  it("is a straight diagonal from Kc mid to Kc end across the late-season stage", () => {
    expect(kcForStage(testCrop, "late", 0, 30)).toBeCloseTo(1.2, 5);
    expect(kcForStage(testCrop, "late", 15, 30)).toBeCloseTo(0.9, 5); // midpoint
    expect(kcForStage(testCrop, "late", 30, 30)).toBeCloseTo(0.6, 5);
  });
});

describe("Root depth growth model (Module 5) matches the spec's worked example", () => {
  const cropLikeSpecExample: CropDefinition = {
    ...testCrop,
    rootDepthMinM: 0.15,
    rootDepthMaxM: 0.75,
  };

  it("is flat at 0.15 m through initial", () => {
    expect(rootDepthForStage(cropLikeSpecExample, "initial", 5, 20)).toBeCloseTo(0.15, 5);
  });

  it("ramps 0.15m -> 0.75m across development", () => {
    expect(rootDepthForStage(cropLikeSpecExample, "development", 0, 30)).toBeCloseTo(0.15, 5);
    expect(rootDepthForStage(cropLikeSpecExample, "development", 30, 30)).toBeCloseTo(0.75, 5);
  });

  it("holds at 0.75m through mid and late (roots do not retract)", () => {
    expect(rootDepthForStage(cropLikeSpecExample, "mid", 0, 40)).toBeCloseTo(0.75, 5);
    expect(rootDepthForStage(cropLikeSpecExample, "late", 29, 30)).toBeCloseTo(0.75, 5);
  });
});

describe("growthStageSummary end-to-end", () => {
  it("returns a coherent dashboard-ready snapshot", () => {
    const summary = growthStageSummary(testCrop, "2026-01-01", "2026-01-25");
    expect(summary.daysAfterPlanting).toBe(24);
    expect(summary.stage).toBe("development");
    expect(summary.kc).toBeGreaterThan(testCrop.kcIni);
    expect(summary.kc).toBeLessThan(testCrop.kcMid);
  });
});
