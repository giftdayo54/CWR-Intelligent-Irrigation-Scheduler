# Data notes: MET_DATA.xlsx quality findings and assumptions made

This file exists so nothing in the engine's output is a silent
assumption. If a number below feels off for your site, it's meant to
be overridden (via the Field/WeatherStation forms), not treated as
gospel.

## MET_DATA.xlsx profiling results

Station: **Nchalo Factory**, period 1 Jan 2020 – 30 Sep 2025 (from the
workbook's own title row), 2,100 daily rows, one continuous run with no
gaps in the date sequence.

Running the parser (`packages/fao-engine/src/metParser.ts`) over the
full file:

| Issue | Count | How it's handled |
|---|---|---|
| RH max < RH min (reversed in source) | 140 rows (~6.7%) | Swapped automatically, row flagged `rh-max-min-swapped` |
| Missing rainfall value | 3 rows | Defaulted to 0 mm, row flagged `missing-rain-assumed-zero` |
| Missing Tmax/Tmin | 1 row | Row flagged `missing-temperature` (not corrected — ET0 for that day will be unreliable) |
| Row skipped entirely (unparseable date at an expected position) | 1 row | Counted in `skippedRowCount` in the import response |
| Sunshine hours > 14.5 (implausible) | 0 rows | none found |
| Negative wind run | 0 rows | none found |

Every flagged row's flags are stored on its `DailyWeather` record, and
the import endpoint returns the first 50 flagged rows plus a total
count so you can review them.

## ET0 cross-check against the station's own "Et" column

The workbook includes its own `Et (mm)` column. This is **not**
guaranteed to be FAO-56 Penman-Monteith computed the same way this
engine computes it (different agromet software historically use
different reference-ET conventions), so it's used only as a sanity
check, not ground truth:

- 2,099 usable day-pairs (days with Tmax/Tmin/RH/radiation/wind all present)
- This engine's Penman-Monteith: **mean 4.12 mm/day**
- Station's own Et column: **mean 4.66 mm/day**
- Correlation: **r = 0.974**, RMSE = 0.94 mm/day

The strong correlation says the engine is responding to the right
day-to-day weather signal. The ~12% mean gap is worth investigating if
you rely on this data operationally — plausible causes include a
different wind-measurement height than the 2 m default assumed below,
a different soil heat flux treatment, or the station column being a
pan-derived or locally-calibrated ET rather than strict FAO-56 PM. It
is not something this engine can resolve without knowing exactly how
the station's own Et column was computed.

## Assumptions made where Module 4 or the source file didn't specify a value

- **Station coordinates**: latitude -16.27°, longitude 34.9°, elevation
  60 m were used for Nchalo Factory based on its general location in
  Chikwawa District, Malawi — not stated in MET_DATA.xlsx itself.
  **Override these in the Weather Station form with your surveyed
  values** — ET0 is sensitive to latitude (via Ra) and elevation (via
  atmospheric pressure/γ).
- **Anemometer height**: assumed 2 m (the FAO-56 standard), configurable
  per station. If your instrument is mounted higher, set
  `anemometerHeightM` accordingly — the engine applies the Table 15
  logarithmic wind-profile correction automatically.
- **Soil texture → available water capacity (Table `soilTextures.ts`)**:
  Module 4 discusses soil water-holding capacity qualitatively
  (Chapter 7) and repeatedly recommends lab analysis over a generic
  table. The mm/m figures used as defaults here are the standard
  published ranges (consistent in order of magnitude with the module's
  own worked examples: ~100 mm/m for a "light soil", ~140-160 mm/m for
  clay soils) — **not a Module 4 table itself**. Every Field has a
  `totalAvailableMoistureMmPerM` override field for lab-measured data,
  which the engine always prefers when present.
- **Crop database (Tables 20/21/54/57)**: Table 20 (stage lengths)
  gives multiple regional variants per crop; one representative variant
  was chosen per crop (documented in `cropData.ts` comments). Table 57
  (Ky) does not list every crop — Lettuce, Carrots, Cucumbers and Rice
  have no Ky value on file; the Yield Response endpoint requires the
  user's own Ky for those crops (`POST /api/yield/calculate`) rather
  than guessing one.
- **Daily effective rainfall for the dashboard/balance simulation**:
  Module 4's USDA method (Table 26) is inherently monthly. The
  `/balance` endpoint computes the USDA monthly effective-rainfall
  total for each calendar month, then spreads it across that month's
  days in proportion to each day's share of the month's rainfall —
  documented in `balanceService.ts`. This is a modelling
  simplification for the daily chart, not an FAO equation of its own.
  The `/irrigation/:id/schedule` endpoint instead uses a simpler flat
  80% rainfall-effectiveness assumption for its day-by-day trigger
  logic (also documented at the point of use) — the two endpoints are
  not currently reconciled to use identical daily rainfall figures.
- **ETc_adj for the Yield Response module**: Module 4 takes ETc_adj
  (actual crop water use under whatever regime you're evaluating) as a
  *known input* to Equation 27 — it doesn't derive it from a water
  balance. `GET /api/yield/:plantingId` approximates it as
  `ETc − Σ max(depletion − RAM, 0)` across the period, i.e. potential
  water use minus the portion of each day's deficit that exceeded
  readily available moisture. This is a reasonable engineering proxy,
  not an FAO formula — for a defensible Equation 27 result, prefer
  `POST /api/yield/calculate` with your own measured or estimated
  ETc_adj.
- **Irrigation system efficiencies**: Table 30 defaults used exactly as
  given (Surface 45%, Sprinkler 75%, Drip/localized 90%), overridable
  per planting via `systemEfficiencyOverride`.
