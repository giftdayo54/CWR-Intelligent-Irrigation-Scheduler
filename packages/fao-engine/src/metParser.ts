/**
 * Parses a "Met report" weather workbook using the exact structure of
 * the uploaded MET_DATA.xlsx (Nchalo Factory export):
 *
 *   Row 1: "Meteorological Report for the period <start> to <end> for site <name>"
 *   Row 4: merged group headers (Temperature & VPD / Thermohygrograph
 *          Readings / Energy & Rainfall / A Pan Readings / Wind /
 *          Soil Temperatures)
 *   Row 5: column headers (Date, Maximum Temperature (oC), ...)
 *   Rows 6-7: blank
 *   Row 8 onward: one row per day
 *   After the daily rows: TOT/AVG, LTM, and a "Variable / Current / LTM
 *   / % Diff" summary block — parsing stops at the first row whose
 *   Date column does not parse as a date.
 *
 * Column headers are matched by name (not fixed position) so the
 * parser tolerates minor column reordering; it falls back to the
 * documented Nchalo column order if a header can't be matched.
 */
import * as XLSX from "xlsx";
import { DailyMetRecord } from "./types";

const HEADER_MAP: Record<string, keyof DailyMetRecord> = {
  "date": "date",
  "maximum temperature (oc)": "maxTemperatureC",
  "minimum temperature (oc)": "minTemperatureC",
  "rh max (%)": "rhMaxPct",
  "rh min (%)": "rhMinPct",
  "dry bulb temperature @ 08h00 (oc)": "dryBulb08C",
  "dry bulb temperature @ 14h00 (oc)": "dryBulb14C",
  "wet bulb temperature @ 08h00 (oc)": "wetBulb08C",
  "wet bulb temperature @ 14h00 (oc)": "wetBulb14C",
  "maximum reset (oc)": "maxResetC",
  "minimum reset (oc)": "minResetC",
  "grass minimum (oc)": "grassMinC",
  "temperature @ 08h00 (oc)": "temp08C",
  "rh @ 08h00 (%)": "rh08Pct",
  "temperature @ 14h00 (oc)": "temp14C",
  "rh @ 14h00 (%)": "rh14Pct",
  "et (mm)": "etStationMm",
  "rain (mm)": "rainMm",
  "radiation (mj/m2)": "radiationMJm2",
  "sunhours": "sunHours",
  "no. dips": "noDips",
  "class a pan (mm)": "classAPanMm",
  "wind run (km/day)": "windRunKmDay",
  "anemometer reading": "anemometerReading",
  "5 cm @08h00 (oc)": "soilTemp5cm08C",
  "10 cm @08h00 (oc)": "soilTemp10cm08C",
  "20 cm @08h00 (oc)": "soilTemp20cm08C",
  "100 cm @08h00 (oc)": "soilTemp100cm08C",
  "5 cm @14h00 (oc)": "soilTemp5cm14C",
  "10 cm @14h00 (oc)": "soilTemp10cm14C",
  "20 cm @14h00 (oc)": "soilTemp20cm14C",
  "100 cm @14h00 (oc)": "soilTemp100cm14C",
};

// Fallback column order (0-indexed), used for any header cell that
// doesn't match HEADER_MAP above — this is the exact Nchalo layout.
const FALLBACK_ORDER: (keyof DailyMetRecord)[] = [
  "date",
  "maxTemperatureC",
  "minTemperatureC",
  "rhMaxPct",
  "rhMinPct",
  "dryBulb08C",
  "dryBulb14C",
  "wetBulb08C",
  "wetBulb14C",
  "maxResetC",
  "minResetC",
  "grassMinC",
  "temp08C",
  "rh08Pct",
  "temp14C",
  "rh14Pct",
  "etStationMm",
  "rainMm",
  "radiationMJm2",
  "sunHours",
  "noDips",
  "classAPanMm",
  "windRunKmDay",
  "anemometerReading",
  "soilTemp5cm08C",
  "soilTemp10cm08C",
  "soilTemp20cm08C",
  "soilTemp100cm08C",
  "soilTemp5cm14C",
  "soilTemp10cm14C",
  "soilTemp20cm14C",
  "soilTemp100cm14C",
];

export interface ParsedMetWorkbook {
  stationNameFromTitle?: string;
  periodStartFromTitle?: string;
  periodEndFromTitle?: string;
  records: DailyMetRecord[];
  /** Rows skipped entirely because the date cell wasn't parseable at a
   * position where a daily row was expected (rare — usually 0). */
  skippedRowCount: number;
}

function normalizeHeader(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function excelSerialToISO(serial: number): string {
  // Excel's epoch (1900 date system, with the well-known 1900 leap-year bug
  // baked into the serial numbering that SheetJS itself replicates).
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  const d = new Date(utcMs);
  return toISO(d);
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseDateCell(cell: unknown): string | null {
  if (cell instanceof Date && !isNaN(cell.getTime())) return toISO(cell);
  if (typeof cell === "number" && isFinite(cell) && cell > 0) return excelSerialToISO(cell);
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && /\d{4}/.test(trimmed)) return toISO(d);
  }
  return null;
}

function toNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isFinite(n) ? n : undefined;
}

export function parseMetWorkbook(buffer: Buffer | ArrayBuffer, sheetName?: string): ParsedMetWorkbook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[sheetName ?? wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  let stationNameFromTitle: string | undefined;
  let periodStartFromTitle: string | undefined;
  let periodEndFromTitle: string | undefined;
  const titleRow = rows.find((r) => typeof r[0] === "string" && /meteorological report/i.test(r[0] as string));
  if (titleRow) {
    const title = String(titleRow[0]);
    const m = title.match(/period\s+([\d/]+)\s+to\s+([\d/]+)\s+for\s+site\s+(.+)$/i);
    if (m) {
      periodStartFromTitle = m[1];
      periodEndFromTitle = m[2];
      stationNameFromTitle = m[3].trim();
    }
  }

  // Locate the header row: the row whose first cell normalizes to "date".
  const headerRowIdx = rows.findIndex((r) => normalizeHeader(r[0]) === "date");
  if (headerRowIdx === -1) {
    throw new Error('Could not find the header row (a row whose first column is "Date").');
  }
  const headerRow = rows[headerRowIdx];
  const fieldForCol: (keyof DailyMetRecord | undefined)[] = headerRow.map((h, i) => {
    const norm = normalizeHeader(h);
    return HEADER_MAP[norm] ?? FALLBACK_ORDER[i];
  });

  const records: DailyMetRecord[] = [];
  let skippedRowCount = 0;
  let consecutiveUnparseable = 0;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || c === "")) continue; // blank spacer row
    const iso = parseDateCell(row[0]);
    if (!iso) {
      consecutiveUnparseable++;
      if (records.length > 0 && consecutiveUnparseable >= 1) break; // hit the TOT/AVG / summary block
      skippedRowCount++;
      continue;
    }
    consecutiveUnparseable = 0;

    const flags: string[] = [];
    const rec: Partial<DailyMetRecord> = { date: iso };
    for (let c = 1; c < row.length; c++) {
      const field = fieldForCol[c];
      if (!field || field === "date") continue;
      (rec as Record<string, number | undefined>)[field] = toNum(row[c]);
    }

    if (rec.maxTemperatureC == null || rec.minTemperatureC == null) {
      flags.push("missing-temperature");
    }
    if (rec.rhMaxPct != null && rec.rhMinPct != null && rec.rhMaxPct < rec.rhMinPct) {
      const tmp = rec.rhMaxPct;
      rec.rhMaxPct = rec.rhMinPct;
      rec.rhMinPct = tmp;
      flags.push("rh-max-min-swapped");
    }
    if (rec.rhMaxPct != null && rec.rhMaxPct > 100) {
      rec.rhMaxPct = 100;
      flags.push("rh-max-clamped-100");
    }
    if (rec.rainMm == null) {
      rec.rainMm = 0;
      flags.push("missing-rain-assumed-zero");
    }
    if (rec.sunHours != null && rec.sunHours > 14.5) {
      flags.push("sunhours-implausible");
    }
    if (rec.windRunKmDay != null && rec.windRunKmDay < 0) {
      flags.push("negative-wind-run");
    }

    records.push({ ...(rec as DailyMetRecord), flags: flags.length ? flags : undefined });
  }

  return { stationNameFromTitle, periodStartFromTitle, periodEndFromTitle, records, skippedRowCount };
}
