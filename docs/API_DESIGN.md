# API Design

Base URL: `http://localhost:4000` (dev). All endpoints except
`/health`, `/api/auth/register` and `/api/auth/login` require
`Authorization: Bearer <token>`.

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name, role }` | role: FARMER \| IRRIGATION_ENGINEER \| RESEARCHER \| STUDENT \| EXTENSION_OFFICER |
| POST | `/api/auth/login` | `{ email, password }` | returns `{ token, user }` |
| GET | `/api/auth/me` | — | current user |

## Farms / Stations / Fields

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/farms` | list / create |
| GET | `/api/farms/:id` | includes fields + stations |
| DELETE | `/api/farms/:id` | |
| GET/POST | `/api/stations?farmId=` | weather stations |
| GET/POST | `/api/fields?farmId=` | soil texture, area, linked station |
| PATCH | `/api/fields/:id` | |

## Weather (Module 2)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/weather/:stationId?start=&end=` | daily rows in range |
| POST | `/api/weather/:stationId/import` | multipart `file` — MET_DATA.xlsx-structured workbook |
| POST | `/api/weather/:stationId/manual` | single-day manual entry |

Import response includes `flaggedRows` (RH max/min swaps, missing
rainfall, implausible sunshine hours) — see `docs/DATA_NOTES.md`.

## Crops (Module 2: Smart Crop Database)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/crops` | seeded crops + your custom crops |
| GET | `/api/crops/:id` | |
| POST | `/api/crops` | create a custom crop (Kc/stage/root/P inputs) |

## Plantings (Modules 3-6, 12, 13)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/plantings?fieldId=` | list / create |
| GET | `/api/plantings/:id` | includes recent irrigation events |
| GET | `/api/plantings/:id/dashboard?date=` | Module 13 widget: DAP, stage, Kc, root depth, soil moisture, net/gross IR, next irrigation date |
| GET | `/api/plantings/:id/season-series` | full-season daily Kc + root depth (Modules 4/5/12) |
| GET | `/api/plantings/:id/balance?start=&end=` | daily ET0/Kc/ETc + soil water balance (Module 7) |
| POST | `/api/plantings/:id/irrigation-events` | log an actual irrigation application |

## ET0 Calculator (Module 1, standalone)

| Method | Path | Body |
|---|---|---|
| POST | `/api/et0/penman-monteith` | `{ date, latitudeDeg, elevationM, anemometerHeightM, maxTemperatureC, minTemperatureC, rhMaxPct?, rhMinPct?, windRunKmDay?, sunHours?, radiationMJm2? }` |
| POST | `/api/et0/class-a-pan` | `{ date, epanMm, siting, fetchM, windSpeedMs, rhPct }` |

Both return the full intermediate breakdown (Δ, γ, es, ea, Ra, Rn,
u2, etc.) for the "Equation Breakdown" UI requirement.

## Irrigation (Modules 8-11)

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/api/irrigation/effective-rainfall` | `{ method, monthlyRainfallMm, monthlyETcMm, storageMm?, efficiencyFraction? }` | USDA Table 26 or flat user-defined % |
| POST | `/api/irrigation/net-gross` | `{ etcMm, effectiveRainfallMm, groundwaterContributionMm?, soilWaterContributionMm?, leachingRequirementMm? }` | returns IRn + IRg for surface/sprinkler/drip |
| GET | `/api/irrigation/:plantingId/frequency?date=` | | Equation 28, current stage |
| POST | `/api/irrigation/:plantingId/schedule?start=&end=` | | full event list; requires `applicationRateMmPerHour` set on the planting |

## Yield response (Module 14)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/yield/calculate` | `{ ky, etcMm, etcAdjMm }` — standalone Equation 27 |
| GET | `/api/yield/:plantingId?start=&end=` | derives ETc/ETc_adj from the planting's own simulation (see `DATA_NOTES.md` for the approximation used) |

## Error shape

```json
{ "error": "human-readable message", "details": { /* zod flatten(), when applicable */ } }
```

## Not yet built (see ROADMAP.md)

Report export endpoints (PDF/Excel/CSV), the AI advisory endpoint, and
multi-season comparison endpoints are not implemented in this drop.
