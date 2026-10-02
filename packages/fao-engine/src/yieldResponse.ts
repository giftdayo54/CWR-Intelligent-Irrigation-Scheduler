/**
 * Module 14: Yield response to water — FAO (1986) Ky method.
 * Equation 27:
 *   1 - Ya/Ym = Ky x (1 - ETc_adj/ETc)
 */
import { YieldResponseInput, YieldResponseResult } from "./types";

export function calculateYieldResponse(input: YieldResponseInput): YieldResponseResult {
  const { ky, etcMm, etcAdjMm } = input;
  const relativeEtDeficit = etcMm > 0 ? 1 - etcAdjMm / etcMm : 0;
  const relativeYieldDecrease = ky * relativeEtDeficit;
  const actualYieldPctOfMax = round((1 - relativeYieldDecrease) * 100, 1);
  return {
    ky,
    relativeEtDeficit: round(relativeEtDeficit, 4),
    relativeYieldDecrease: round(relativeYieldDecrease, 4),
    actualYieldPctOfMax,
  };
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
