/**
 * Table 1 (Module 4, p.7): Pan coefficients (Kp) for Class A pan, by
 * siting (Case A: pan in short green cropped area; Case B: pan in dry
 * fallow area), fetch distance, wind class and mean RH class.
 * Source: FAO, 1984.
 */
export type KpSiting = "case-a-green-crop" | "case-b-dry-fallow";
export type KpWindClass = "light" | "moderate" | "strong" | "very-strong"; // <2, 2-5, 5-8, >8 m/s
export type KpHumidityClass = "low" | "medium" | "high"; // <40%, 40-70%, >70%

export interface KpTableRow {
  siting: KpSiting;
  windClass: KpWindClass;
  fetchM: 1 | 10 | 100 | 1000;
  kp: Record<KpHumidityClass, number>;
}

export const KP_TABLE: KpTableRow[] = [
  // Case A: pan in short green cropped area
  { siting: "case-a-green-crop", windClass: "light", fetchM: 1, kp: { low: 0.55, medium: 0.65, high: 0.75 } },
  { siting: "case-a-green-crop", windClass: "light", fetchM: 10, kp: { low: 0.65, medium: 0.75, high: 0.85 } },
  { siting: "case-a-green-crop", windClass: "light", fetchM: 100, kp: { low: 0.7, medium: 0.8, high: 0.85 } },
  { siting: "case-a-green-crop", windClass: "light", fetchM: 1000, kp: { low: 0.75, medium: 0.85, high: 0.85 } },
  { siting: "case-a-green-crop", windClass: "moderate", fetchM: 1, kp: { low: 0.5, medium: 0.6, high: 0.65 } },
  { siting: "case-a-green-crop", windClass: "moderate", fetchM: 10, kp: { low: 0.6, medium: 0.7, high: 0.75 } },
  { siting: "case-a-green-crop", windClass: "moderate", fetchM: 100, kp: { low: 0.65, medium: 0.75, high: 0.8 } },
  { siting: "case-a-green-crop", windClass: "moderate", fetchM: 1000, kp: { low: 0.7, medium: 0.8, high: 0.8 } },
  { siting: "case-a-green-crop", windClass: "strong", fetchM: 1, kp: { low: 0.45, medium: 0.5, high: 0.6 } },
  { siting: "case-a-green-crop", windClass: "strong", fetchM: 10, kp: { low: 0.55, medium: 0.6, high: 0.65 } },
  { siting: "case-a-green-crop", windClass: "strong", fetchM: 100, kp: { low: 0.6, medium: 0.65, high: 0.7 } },
  { siting: "case-a-green-crop", windClass: "strong", fetchM: 1000, kp: { low: 0.65, medium: 0.7, high: 0.75 } },
  { siting: "case-a-green-crop", windClass: "very-strong", fetchM: 1, kp: { low: 0.4, medium: 0.45, high: 0.5 } },
  { siting: "case-a-green-crop", windClass: "very-strong", fetchM: 10, kp: { low: 0.45, medium: 0.55, high: 0.6 } },
  { siting: "case-a-green-crop", windClass: "very-strong", fetchM: 100, kp: { low: 0.5, medium: 0.6, high: 0.65 } },
  { siting: "case-a-green-crop", windClass: "very-strong", fetchM: 1000, kp: { low: 0.55, medium: 0.6, high: 0.65 } },
  // Case B: pan in dry fallow area
  { siting: "case-b-dry-fallow", windClass: "light", fetchM: 1, kp: { low: 0.7, medium: 0.8, high: 0.85 } },
  { siting: "case-b-dry-fallow", windClass: "light", fetchM: 10, kp: { low: 0.6, medium: 0.7, high: 0.8 } },
  { siting: "case-b-dry-fallow", windClass: "light", fetchM: 100, kp: { low: 0.55, medium: 0.65, high: 0.75 } },
  { siting: "case-b-dry-fallow", windClass: "light", fetchM: 1000, kp: { low: 0.5, medium: 0.6, high: 0.7 } },
  { siting: "case-b-dry-fallow", windClass: "moderate", fetchM: 1, kp: { low: 0.65, medium: 0.75, high: 0.8 } },
  { siting: "case-b-dry-fallow", windClass: "moderate", fetchM: 10, kp: { low: 0.55, medium: 0.65, high: 0.7 } },
  { siting: "case-b-dry-fallow", windClass: "moderate", fetchM: 100, kp: { low: 0.5, medium: 0.6, high: 0.65 } },
  { siting: "case-b-dry-fallow", windClass: "moderate", fetchM: 1000, kp: { low: 0.45, medium: 0.55, high: 0.6 } },
  { siting: "case-b-dry-fallow", windClass: "strong", fetchM: 1, kp: { low: 0.6, medium: 0.65, high: 0.7 } },
  { siting: "case-b-dry-fallow", windClass: "strong", fetchM: 10, kp: { low: 0.5, medium: 0.55, high: 0.65 } },
  { siting: "case-b-dry-fallow", windClass: "strong", fetchM: 100, kp: { low: 0.45, medium: 0.5, high: 0.6 } },
  { siting: "case-b-dry-fallow", windClass: "strong", fetchM: 1000, kp: { low: 0.4, medium: 0.45, high: 0.55 } },
  { siting: "case-b-dry-fallow", windClass: "very-strong", fetchM: 1, kp: { low: 0.5, medium: 0.6, high: 0.65 } },
  { siting: "case-b-dry-fallow", windClass: "very-strong", fetchM: 10, kp: { low: 0.45, medium: 0.5, high: 0.55 } },
  { siting: "case-b-dry-fallow", windClass: "very-strong", fetchM: 100, kp: { low: 0.4, medium: 0.45, high: 0.5 } },
  { siting: "case-b-dry-fallow", windClass: "very-strong", fetchM: 1000, kp: { low: 0.35, medium: 0.4, high: 0.45 } },
];

/** Table 1 footnote adjustments (Module 4, 2.2.3), applied as
 * multiplicative nudges the UI can offer as optional toggles rather
 * than baking them into the base table. */
export const KP_ADJUSTMENTS = {
  bareSoilArid: { min: 0.8, max: 0.95 }, // reduce listed Kp 5-20% in extensive bare-soil/arid areas
  tallSurroundingCropsDryWindy: { min: 1.0, max: 1.3 }, // increase up to 30% when surrounded by tall crops (dry, windy)
  tallSurroundingCropsCalmHumid: { min: 1.05, max: 1.1 },
  blackPaintedPan: { min: 1.0, max: 1.1 }, // increase up to 10% if pan painted black instead of aluminium
} as const;
