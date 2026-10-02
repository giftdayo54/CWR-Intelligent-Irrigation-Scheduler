/**
 * Shared types for the FAO Module 4 calculation engine.
 * Field names mirror FAO Irrigation Manual Module 4 terminology so the
 * engine reads like the manual it implements.
 */

/** One row of daily station weather, using the exact structure of the
 * uploaded MET_DATA.xlsx ("Met report" sheet, Nchalo Factory format).
 * Every field name below corresponds 1:1 to a column in that sheet.
 * Optional fields are columns that are frequently blank in the source
 * file (confirmed by profiling MET_DATA.xlsx: Grass Minimum and the
 * 08h00/14h00 spot Temperature columns are >95% empty; soil
 * temperatures below 20cm are >80% empty).
 */
export interface DailyMetRecord {
  date: string; // ISO yyyy-mm-dd
  maxTemperatureC: number; // "Maximum Temperature (oC)"
  minTemperatureC: number; // "Minimum Temperature (oC)"
  rhMaxPct?: number; // "RH max (%)"
  rhMinPct?: number; // "RH Min (%)"
  dryBulb08C?: number; // "Dry Bulb Temperature @ 08h00 (oC)"
  dryBulb14C?: number; // "Dry Bulb Temperature @ 14h00 (oC)"
  wetBulb08C?: number; // "Wet Bulb Temperature @ 08h00 (oC)"
  wetBulb14C?: number; // "Wet Bulb Temperature @ 14h00 (oC)"
  maxResetC?: number; // "Maximum Reset (oC)"
  minResetC?: number; // "Minimum Reset (oC)"
  grassMinC?: number; // "Grass Minimum (oC)"
  temp08C?: number; // "Temperature @ 08h00 (oC)" (thermohygrograph)
  rh08Pct?: number; // "RH @ 08h00 (%)"
  temp14C?: number; // "Temperature @ 14h00 (oC)"
  rh14Pct?: number; // "RH @ 14h00 (%)"
  etStationMm?: number; // "Et (mm)" — station's own reference ET, kept for cross-checking only
  rainMm: number; // "Rain (mm)"
  radiationMJm2?: number; // "Radiation (MJ/m2)"
  sunHours?: number; // "Sunhours"
  noDips?: number; // "No. Dips" (Class A pan)
  classAPanMm?: number; // "Class A Pan (mm)"
  windRunKmDay?: number; // "Wind run (km/day)"
  anemometerReading?: number; // "Anemometer Reading"
  soilTemp5cm08C?: number;
  soilTemp10cm08C?: number;
  soilTemp20cm08C?: number;
  soilTemp100cm08C?: number;
  soilTemp5cm14C?: number;
  soilTemp10cm14C?: number;
  soilTemp20cm14C?: number;
  soilTemp100cm14C?: number;
  /** Data-quality flags raised while parsing this row (see metParser.ts) */
  flags?: string[];
}

export interface StationConfig {
  name: string;
  latitudeDeg: number; // negative = southern hemisphere
  longitudeDeg: number;
  elevationM: number;
  /** Height above ground of the anemometer, for wind-speed adjustment to
   * the FAO-standard 2 m (Module 4, Eq. after Table 15). Most agro-met
   * stations of this type run at 2 m; override per station if known. */
  anemometerHeightM: number;
}

export type ET0Method = "penman-monteith" | "class-a-pan";

export interface ET0PenmanMonteithBreakdown {
  method: "penman-monteith";
  date: string;
  Tmean: number;
  atmosphericPressureKPa: number;
  psychrometricConstant: number; // gamma
  slopeSvp: number; // Delta
  svpMax: number; // e°(Tmax)
  svpMin: number; // e°(Tmin)
  es: number; // mean saturation vapour pressure
  ea: number; // actual vapour pressure
  vpd: number; // es - ea
  extraterrestrialRadiation: number; // Ra
  daylightHours: number; // N
  clearSkyRadiation: number; // Rso
  solarRadiation: number; // Rs (measured, or estimated from sunshine hours)
  solarRadiationSource: "measured" | "estimated-from-sunshine-hours";
  netShortwaveRadiation: number; // Rns
  netLongwaveRadiation: number; // Rnl
  netRadiation: number; // Rn
  soilHeatFlux: number; // G (0 for daily calculations, per FAO-56)
  windSpeed2m: number; // u2 (m/s)
  ET0: number; // mm/day
}

export interface ET0ClassAPanBreakdown {
  method: "class-a-pan";
  date: string;
  Epan: number;
  Kp: number;
  ET0: number;
}

export type ET0Result = ET0PenmanMonteithBreakdown | ET0ClassAPanBreakdown;

/** A crop's FAO Module 4 reference data (Tables 20, 21, 54). */
export interface CropDefinition {
  id: string;
  name: string;
  scientificName?: string;
  category: string;
  kcIni: number;
  kcMid: number;
  kcEnd: number;
  /** Typical stage lengths in days (Table 20). These are indicative
   * defaults — Module 4 stresses that local data should override them. */
  stageLengthsDays: {
    initial: number;
    development: number;
    mid: number;
    late: number;
  };
  /** Root depth range in metres (Table 54) */
  rootDepthMinM: number;
  rootDepthMaxM: number;
  /** Allowable depletion fraction P at ETc ≈ 5 mm/day (Table 54) */
  allowableDepletionP: number;
  maxCropHeightM?: number;
  /** Yield response factors (Table 57), by growth period, where available */
  ky?: {
    vegetative?: number;
    flowering?: number;
    yieldFormation?: number;
    ripening?: number;
    total: number;
  };
  isCustom?: boolean;
}

export type GrowthStage = "initial" | "development" | "mid" | "late" | "harvested";

export interface GrowthStageResult {
  date: string;
  daysAfterPlanting: number;
  stage: GrowthStage;
  dayInStage: number;
  stageLengthDays: number;
  kc: number;
  rootDepthM: number;
  allowableDepletionP: number;
}

export type SoilTexture =
  | "sand"
  | "loamy-sand"
  | "sandy-loam"
  | "loam"
  | "clay-loam"
  | "clay";

export interface SoilProfile {
  texture: SoilTexture;
  /** Field capacity, volumetric fraction (e.g. 0.28 = 28%) */
  fieldCapacity: number;
  /** Permanent wilting point, volumetric fraction */
  permanentWiltingPoint: number;
  /** Optional lab-measured total available moisture, mm/m — overrides
   * the FC/PWP-derived figure when supplied (Module 4 recommends lab
   * analysis over textbook texture defaults where available). */
  totalAvailableMoistureMmPerM?: number;
}

export interface EffectiveRainfallResult {
  method: "usda" | "user-defined";
  monthlyRainfallMm: number;
  monthlyETcMm: number;
  effectiveRainfallMm: number;
  storageFactor: number;
  rainfallEfficiencyPct: number;
  runoffLossMm: number;
}

export type IrrigationSystem = "surface" | "sprinkler" | "drip";

export interface NetIrrigationRequirementInput {
  etcMm: number;
  effectiveRainfallMm: number;
  groundwaterContributionMm?: number; // Ge
  soilWaterContributionMm?: number; // Wb
  leachingRequirementMm?: number; // LR
}

export interface YieldResponseInput {
  ky: number;
  etcMm: number; // ETc (potential, no water stress)
  etcAdjMm: number; // ETc adj (actual, under the water regime being evaluated)
}

export interface YieldResponseResult {
  ky: number;
  relativeEtDeficit: number; // 1 - ETcadj/ETc
  relativeYieldDecrease: number; // 1 - Ya/Ym
  actualYieldPctOfMax: number; // Ya/Ym * 100
}
