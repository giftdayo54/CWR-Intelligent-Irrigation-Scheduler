import { describe, it, expect } from "vitest";
import { calculateYieldResponse } from "../src/yieldResponse";

describe("FAO Ky yield response (Equation 27) vs. Module 4 Example 11", () => {
  it("part 1: 10% water deficit spread evenly over the season, Ky=1.05 -> 10.5% yield reduction, 89.5% of Ym", () => {
    const result = calculateYieldResponse({ ky: 1.05, etcMm: 820, etcAdjMm: 820 - 82 });
    expect(result.relativeEtDeficit).toBeCloseTo(0.1, 5);
    expect(result.relativeYieldDecrease).toBeCloseTo(0.105, 5);
    expect(result.actualYieldPctOfMax).toBeCloseTo(89.5, 1);
  });

  it("part 2: 30% deficit in September (150mm requirement per the worked arithmetic, 48mm short), Ky=1.1", () => {
    // The module's own prose rounds the intermediate deficit fraction
    // (48/150 = 0.32) to one decimal place ("0.3") before multiplying
    // by Ky, giving a published 33% reduction. This engine keeps full
    // precision throughout, so it is compared with a tolerance wide
    // enough to absorb that manual rounding rather than reproducing it.
    const result = calculateYieldResponse({ ky: 1.1, etcMm: 150, etcAdjMm: 150 - 48 });
    expect(result.relativeEtDeficit).toBeCloseTo(0.3, 1);
    expect(result.relativeYieldDecrease).toBeCloseTo(0.33, 1);
  });

  it("no deficit means no yield loss regardless of Ky", () => {
    const result = calculateYieldResponse({ ky: 1.25, etcMm: 500, etcAdjMm: 500 });
    expect(result.relativeYieldDecrease).toBe(0);
    expect(result.actualYieldPctOfMax).toBe(100);
  });
});
