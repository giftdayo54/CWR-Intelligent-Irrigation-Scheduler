import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseMetWorkbook } from "../src/metParser";

describe("parseMetWorkbook against the real Nchalo Factory MET_DATA.xlsx", () => {
  const fixture = path.join(__dirname, "fixtures", "MET_DATA.xlsx");
  const buf = fs.readFileSync(fixture);
  const parsed = parseMetWorkbook(buf);

  it("extracts the station name and period from the title row", () => {
    expect(parsed.stationNameFromTitle).toBe("Nchalo Factory");
    expect(parsed.periodStartFromTitle).toBe("1/1/2020");
    expect(parsed.periodEndFromTitle).toBe("9/30/2025");
  });

  it("stops before the TOT/AVG summary block (2100 daily rows, not 2131)", () => {
    expect(parsed.records.length).toBe(2100);
  });

  it("maps every documented column to the right field", () => {
    const jan1 = parsed.records[0];
    expect(jan1.maxTemperatureC).toBeCloseTo(32, 5);
    expect(jan1.minTemperatureC).toBeCloseTo(22, 5);
    expect(jan1.rainMm).toBeCloseTo(23, 5);
    expect(jan1.radiationMJm2).toBeCloseTo(10.122504, 3);
    expect(jan1.windRunKmDay).toBeCloseTo(126.4, 1);
    expect(jan1.anemometerReading).toBeCloseTo(2178.07, 1);
  });

  it("flags and corrects rows where RH max / RH min are reversed in the source file", () => {
    const flagged = parsed.records.filter((r) => r.flags?.includes("rh-max-min-swapped"));
    expect(flagged.length).toBeGreaterThan(50); // ~140 rows profiled as reversed in the source data
    for (const r of flagged) {
      expect(r.rhMaxPct!).toBeGreaterThanOrEqual(r.rhMinPct!);
    }
  });

  it("defaults missing rainfall to 0 and flags it rather than silently dropping the day", () => {
    const missingRain = parsed.records.filter((r) => r.flags?.includes("missing-rain-assumed-zero"));
    expect(missingRain.length).toBeGreaterThan(0);
    for (const r of missingRain) expect(r.rainMm).toBe(0);
  });
});
