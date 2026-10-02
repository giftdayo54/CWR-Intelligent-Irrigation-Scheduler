import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  saturationVapourPressure,
  slopeOfSvpCurve,
  psychrometricConstant,
  extraterrestrialRadiation,
  daylightHours,
  calculateET0PenmanMonteith,
} from "../src/et0";
import { parseMetWorkbook } from "../src/metParser";
import { StationConfig } from "../src/types";

describe("Penman-Monteith building blocks vs. Module 4 Tables 3-5", () => {
  it("matches Table 4 saturation vapour pressure at 20/25/30 degC", () => {
    expect(saturationVapourPressure(20)).toBeCloseTo(2.338, 2);
    expect(saturationVapourPressure(25)).toBeCloseTo(3.168, 2);
    expect(saturationVapourPressure(30)).toBeCloseTo(4.243, 2);
  });

  it("matches Table 5 slope of the SVP curve at 20/25/30 degC", () => {
    expect(slopeOfSvpCurve(20)).toBeCloseTo(0.145, 2);
    expect(slopeOfSvpCurve(25)).toBeCloseTo(0.189, 2);
    expect(slopeOfSvpCurve(30)).toBeCloseTo(0.243, 2);
  });

  it("matches Table 3 psychrometric constant at sea level / 1000m / 2000m", () => {
    expect(psychrometricConstant(0)).toBeCloseTo(0.067, 2);
    expect(psychrometricConstant(1000)).toBeCloseTo(0.06, 2);
    expect(psychrometricConstant(2000)).toBeCloseTo(0.053, 2);
  });

  it("computed Ra for mid-January at ~16 deg S is close to Table 9's tabulated value (41.1 MJ/m2)", () => {
    const ra = extraterrestrialRadiation(-16.27, 15);
    expect(ra).toBeCloseTo(41.1, 0);
    const n = daylightHours(-16.27, 15);
    expect(n).toBeGreaterThan(12.5);
    expect(n).toBeLessThan(13.2);
  });
});

describe("Full-season cross-check against MET_DATA.xlsx (Nchalo Factory)", () => {
  const fixture = path.join(__dirname, "fixtures", "MET_DATA.xlsx");
  const buf = fs.readFileSync(fixture);
  const parsed = parseMetWorkbook(buf);

  const station: StationConfig = {
    name: parsed.stationNameFromTitle ?? "Nchalo Factory",
    latitudeDeg: -16.27,
    longitudeDeg: 34.9,
    elevationM: 60,
    anemometerHeightM: 2,
  };

  it("parses all 2100 daily rows with no missing dates", () => {
    expect(parsed.records.length).toBe(2100);
    expect(parsed.records[0].date).toBe("2020-01-01");
    expect(parsed.records[parsed.records.length - 1].date).toBe("2025-09-30");
  });

  it("computed ET0 tracks the station's own recorded Et column closely", () => {
    const usable = parsed.records.filter(
      (r) => r.etStationMm != null && r.radiationMJm2 != null && r.windRunKmDay != null
    );
    const pairs = usable.map((r) => ({
      computed: calculateET0PenmanMonteith(r, station).ET0,
      station: r.etStationMm as number,
    }));

    const n = pairs.length;
    expect(n).toBeGreaterThan(2000);

    const meanC = pairs.reduce((s, p) => s + p.computed, 0) / n;
    const meanS = pairs.reduce((s, p) => s + p.station, 0) / n;
    const cov = pairs.reduce((s, p) => s + (p.computed - meanC) * (p.station - meanS), 0) / n;
    const sdC = Math.sqrt(pairs.reduce((s, p) => s + (p.computed - meanC) ** 2, 0) / n);
    const sdS = Math.sqrt(pairs.reduce((s, p) => s + (p.station - meanS) ** 2, 0) / n);
    const correlation = cov / (sdC * sdS);

    // The station's own "Et" column is not documented as being derived
    // by the identical FAO-56 Penman-Monteith procedure (it may be a
    // different reference-ET convention), so this is a plausibility
    // check, not an exact-match test: a strong correlation and a
    // physically reasonable mean confirm the engine is reading the
    // real inputs correctly and producing sane, weather-responsive
    // output, not a red-flag threshold.
    expect(correlation).toBeGreaterThan(0.9);
    expect(meanC).toBeGreaterThan(2.5);
    expect(meanC).toBeLessThan(7);
  });
});
