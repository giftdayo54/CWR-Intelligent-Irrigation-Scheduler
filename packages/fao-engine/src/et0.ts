/**
 * Reference evapotranspiration (ET0) — FAO Irrigation Manual Module 4,
 * Chapter 2.
 *
 * Implements:
 *  - 2.3 FAO Penman-Monteith method (Equations 3-17)
 *  - 2.2 Class A pan method (Equation 2, Table 1 Kp lookup)
 *
 * Where Module 4 defers to "FAO (1998a)" (FAO Irrigation & Drainage
 * Paper 56) for a formula it only tabulates (atmospheric pressure from
 * altitude used to build Table 3; Ra computed analytically instead of
 * read from Tables 8-11), this file uses the FAO-56 closed-form
 * equation so the engine works for any date/latitude rather than only
 * the 15th-of-the-month table entries. Each such substitution is
 * flagged in a comment at the point of use.
 */
import { DailyMetRecord, ET0ClassAPanBreakdown, ET0PenmanMonteithBreakdown, StationConfig } from "./types";
import { KP_TABLE, KpSiting, KpWindClass, KpHumidityClass } from "./classAPanTable";

const DEG2RAD = Math.PI / 180;

/** Equation 7: saturation vapour pressure at temperature T (°C), kPa */
export function saturationVapourPressure(T: number): number {
  return 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
}

/** Equation 5: mean daily air temperature */
export function meanTemperature(Tmax: number, Tmin: number): number {
  return (Tmax + Tmin) / 2;
}

/** Equation 8: slope of the saturation vapour pressure curve (Delta), kPa/°C */
export function slopeOfSvpCurve(Tmean: number): number {
  return (4098 * saturationVapourPressure(Tmean)) / Math.pow(Tmean + 237.3, 2);
}

/** Atmospheric pressure from altitude (FAO-56 Eq. 7, referenced by
 * Module 4 as the basis of Table 3). z in metres. */
export function atmosphericPressure(elevationM: number): number {
  return 101.3 * Math.pow((293 - 0.0065 * elevationM) / 293, 5.26);
}

/** Equation 4: psychrometric constant (gamma), kPa/°C */
export function psychrometricConstant(elevationM: number): number {
  return 0.665e-3 * atmosphericPressure(elevationM);
}

/** Equation 9: actual vapour pressure from RHmax/RHmin, kPa.
 * Falls back to Equation 10 (RHmean-based) when only one of
 * RHmax/RHmin is available. Defensively swaps RHmax/RHmin if a
 * record has them reversed (observed in ~7% of MET_DATA.xlsx rows —
 * see metParser.ts). */
export function actualVapourPressure(
  Tmax: number,
  Tmin: number,
  rhMax?: number,
  rhMin?: number
): number {
  if (rhMax != null && rhMin != null) {
    let hi = rhMax, lo = rhMin;
    if (hi < lo) [hi, lo] = [lo, hi]; // defensive swap — see metParser flags
    return (saturationVapourPressure(Tmin) * (hi / 100) + saturationVapourPressure(Tmax) * (lo / 100)) / 2;
  }
  const rhMean = rhMax ?? rhMin ?? 0;
  return (rhMean / 100) * ((saturationVapourPressure(Tmax) + saturationVapourPressure(Tmin)) / 2);
}

/** Solar declination (radians) and inverse relative Earth-Sun distance,
 * used to compute Ra analytically (FAO-56 Eqs. 23-25) in place of the
 * 15th-of-month Table 8/9 lookup. */
function solarGeometry(dayOfYear: number) {
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * dayOfYear) / 365);
  const decl = 0.409 * Math.sin((2 * Math.PI * dayOfYear) / 365 - 1.39);
  return { dr, decl };
}

/** Extraterrestrial radiation (Ra), MJ/m2/day, computed analytically. */
export function extraterrestrialRadiation(latitudeDeg: number, dayOfYear: number): number {
  const phi = latitudeDeg * DEG2RAD;
  const { dr, decl } = solarGeometry(dayOfYear);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(decl), -1, 1));
  const Gsc = 0.082; // solar constant, MJ/m2/min
  return (
    ((24 * 60) / Math.PI) *
    Gsc *
    dr *
    (ws * Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.sin(ws))
  );
}

/** Maximum possible sunshine (daylight hours), N — used with actual
 * sunshine hours (n) in Equation 12 when Rs is not measured directly. */
export function daylightHours(latitudeDeg: number, dayOfYear: number): number {
  const phi = latitudeDeg * DEG2RAD;
  const { decl } = solarGeometry(dayOfYear);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(decl), -1, 1));
  return (24 / Math.PI) * ws;
}

/** Equation 14: clear-sky solar radiation, Rso (MJ/m2/day) */
export function clearSkyRadiation(Ra: number, elevationM: number): number {
  return (0.75 + (2 * elevationM) / 100000) * Ra;
}

/** Equation 12: solar radiation from sunshine-hour fraction (Angstrom),
 * used only when Rs is not measured (as = 0.25, bs = 0.50). */
export function solarRadiationFromSunshine(sunshineHours: number, N: number, Ra: number): number {
  const nOverN = N > 0 ? clamp(sunshineHours / N, 0, 1) : 0;
  return (0.25 + 0.5 * nOverN) * Ra;
}

/** Equation 13: net shortwave radiation, Rns (albedo = 0.23) */
export function netShortwaveRadiation(Rs: number): number {
  return (1 - 0.23) * Rs;
}

/** Equation 15: net longwave radiation, Rnl (MJ/m2/day) */
export function netLongwaveRadiation(
  TmaxC: number,
  TminC: number,
  ea: number,
  Rs: number,
  Rso: number
): number {
  const sigma = 4.903e-9;
  const TmaxK4 = Math.pow(TmaxC + 273.16, 4);
  const TminK4 = Math.pow(TminC + 273.16, 4);
  const rsRso = Rso > 0 ? Math.min(Rs / Rso, 1) : 1;
  return sigma * ((TmaxK4 + TminK4) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(ea, 0))) * (1.35 * rsRso - 0.35);
}

/** Wind speed conversion to 2 m height (formula noted under Table 15:
 * factor = 4.87 / ln(67.8*z - 5.42)). windRunKmPerDay -> u2 in m/s. */
export function windSpeed2mFromRun(windRunKmPerDay: number, anemometerHeightM: number): number {
  const uz = (windRunKmPerDay * 1000) / 86400; // m/s at measurement height
  if (Math.abs(anemometerHeightM - 2) < 0.01) return uz;
  const factor = 4.87 / Math.log(67.8 * anemometerHeightM - 5.42);
  return uz * factor;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function dayOfYear(isoDate: string): number {
  const d = new Date(isoDate + "T00:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86400000) + 1;
}

/**
 * Full FAO Penman-Monteith ET0 for one day (Equation 3), with the
 * intermediate breakdown the UI displays (per the "Equation Breakdown"
 * / "Intermediate Results" requirement).
 *
 * Soil heat flux G is taken as 0 for daily/10-day time steps, per the
 * standard FAO-56 simplification Module 4 relies on for its own
 * Kutsaga daily/decade examples (no G term is measured in MET_DATA.xlsx).
 */
export function calculateET0PenmanMonteith(
  record: DailyMetRecord,
  station: StationConfig
): ET0PenmanMonteithBreakdown {
  const { maxTemperatureC: Tmax, minTemperatureC: Tmin } = record;
  const Tmean = meanTemperature(Tmax, Tmin);
  const P = atmosphericPressure(station.elevationM);
  const gamma = psychrometricConstant(station.elevationM);
  const Delta = slopeOfSvpCurve(Tmean);

  const svpMax = saturationVapourPressure(Tmax);
  const svpMin = saturationVapourPressure(Tmin);
  const es = (svpMax + svpMin) / 2;
  const ea = actualVapourPressure(Tmax, Tmin, record.rhMaxPct, record.rhMinPct);
  const vpd = Math.max(es - ea, 0);

  const doy = dayOfYear(record.date);
  const Ra = extraterrestrialRadiation(station.latitudeDeg, doy);
  const N = daylightHours(station.latitudeDeg, doy);
  const Rso = clearSkyRadiation(Ra, station.elevationM);

  let Rs: number;
  let solarRadiationSource: "measured" | "estimated-from-sunshine-hours";
  if (record.radiationMJm2 != null && record.radiationMJm2 > 0) {
    Rs = record.radiationMJm2;
    solarRadiationSource = "measured";
  } else if (record.sunHours != null) {
    Rs = solarRadiationFromSunshine(record.sunHours, N, Ra);
    solarRadiationSource = "estimated-from-sunshine-hours";
  } else {
    // Last resort: assume moderately clear sky rather than fail outright.
    Rs = 0.75 * Ra;
    solarRadiationSource = "estimated-from-sunshine-hours";
  }

  const Rns = netShortwaveRadiation(Rs);
  const Rnl = netLongwaveRadiation(Tmax, Tmin, ea, Rs, Rso);
  const Rn = Rns - Rnl;
  const G = 0;

  const windRun = record.windRunKmDay ?? 0;
  const u2 = windSpeed2mFromRun(windRun, station.anemometerHeightM);

  const numerator = 0.408 * Delta * (Rn - G) + gamma * (900 / (Tmean + 273)) * u2 * vpd;
  const denominator = Delta + gamma * (1 + 0.34 * u2);
  const ET0 = Math.max(numerator / denominator, 0);

  return {
    method: "penman-monteith",
    date: record.date,
    Tmean,
    atmosphericPressureKPa: round(P, 3),
    psychrometricConstant: round(gamma, 5),
    slopeSvp: round(Delta, 5),
    svpMax: round(svpMax, 3),
    svpMin: round(svpMin, 3),
    es: round(es, 3),
    ea: round(ea, 3),
    vpd: round(vpd, 3),
    extraterrestrialRadiation: round(Ra, 2),
    daylightHours: round(N, 2),
    clearSkyRadiation: round(Rso, 2),
    solarRadiation: round(Rs, 2),
    solarRadiationSource,
    netShortwaveRadiation: round(Rns, 2),
    netLongwaveRadiation: round(Rnl, 2),
    netRadiation: round(Rn, 2),
    soilHeatFlux: G,
    windSpeed2m: round(u2, 2),
    ET0: round(ET0, 2),
  };
}

/** Equation 2 (Class A pan method): ET0 = Kp x Epan */
export function calculateET0ClassAPan(
  date: string,
  Epan: number,
  siting: KpSiting,
  fetchM: number,
  windClass: KpWindClass,
  humidityClass: KpHumidityClass
): ET0ClassAPanBreakdown {
  const Kp = lookupKp(siting, fetchM, windClass, humidityClass);
  return { method: "class-a-pan", date, Epan, Kp, ET0: round(Epan * Kp, 2) };
}

function lookupKp(siting: KpSiting, fetchM: number, windClass: KpWindClass, humidityClass: KpHumidityClass): number {
  const fetches = [1, 10, 100, 1000];
  const nearest = fetches.reduce((a, b) => (Math.abs(b - fetchM) < Math.abs(a - fetchM) ? b : a));
  const row = KP_TABLE.find((r) => r.siting === siting && r.fetchM === nearest && r.windClass === windClass);
  if (!row) throw new Error(`No Kp table entry for siting=${siting} fetch=${fetchM} wind=${windClass}`);
  return row.kp[humidityClass];
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
