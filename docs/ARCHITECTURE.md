# System Architecture

## Overview

Three-tier monorepo:

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│   apps/web           │      │   apps/api             │      │   PostgreSQL     │
│   Next.js 14 (App     │─────▶│   Express + TypeScript │─────▶│                  │
│   Router), Tailwind,  │ REST │   JWT auth, Zod         │ SQL  │   via Prisma      │
│   Recharts            │◀─────│   validation             │◀─────│                  │
└─────────────────────┘      └──────────┬────────────┘      └─────────────────┘
                                          │ imports
                                          ▼
                              ┌───────────────────────┐
                              │  packages/fao-engine    │
                              │  Pure functions, no I/O │
                              │  FAO Module 4 methods   │
                              └───────────────────────┘
```

`fao-engine` has zero dependency on Express, Prisma or React — it's a
pure calculation library (only dependency: `xlsx`, for the weather
parser). That's deliberate: it's independently testable (see its 32
unit tests), and it's what the "Engine" deliverables (items 7-11 in
the original brief) actually are — this package.

## Component hierarchy (apps/web)

```
RootLayout (NavBar + auth state)
├── / (HomePage)                      farms → fields → plantings list
├── /login, /register                  auth forms
├── /setup                             4-step wizard: Farm → Station → Field → Planting
├── /et0                               standalone ET0 calculator (PM + Class A pan tabs)
└── /plantings/[id]                    the main workspace for one crop cycle:
    ├── Dashboard widget (Module 13)   DAP, stage, Kc, root depth, soil moisture, next irrigation
    ├── Weather import                 MET_DATA.xlsx-style upload
    ├── Kc / root-depth chart          Recharts, from /season-series
    ├── Soil water balance chart       Recharts, from /balance
    ├── Irrigation schedule table      from POST /irrigation/:id/schedule
    └── Yield response panel           from /yield/:id
```

## Request flow example: the Farm Dashboard widget

1. `GET /api/plantings/:id/dashboard?date=YYYY-MM-DD`
2. `plantings.controller.getDashboard` calls `loadPlantingContext` (loads
   Planting + Field + Farm + Crop + WeatherStation from Postgres,
   enforcing the requesting user owns the farm)
3. Converts DB rows to engine types via `utils/mappers.ts`
4. Calls `growthStageSummary(crop, plantingDate, date)` from
   `fao-engine` — pure function, no DB access
5. If a weather station is linked, pulls the daily weather series
   (`services/weatherService.ts`) and runs `simulatePlanting()`
   (`services/balanceService.ts`), which chains
   `calculateET0PenmanMonteith` → `kcForStage` → `calculateETc` →
   `stepSoilWaterBalance` for every day since planting
6. Projects the next irrigation date from the trailing 7-day mean ETc
7. Returns one JSON payload; the web page renders it directly into the
   Module 13 widget layout

## Data flow: MET_DATA.xlsx import

```
.xlsx upload (multipart)
  → multer (memory buffer)
  → parseMetWorkbook() [fao-engine]     — column-name matching, not
                                            fixed positions; defensive
                                            RH swap/clamp, missing-rain
                                            handling (see DATA_NOTES.md)
  → DailyWeather upsert (one row per   — unique on (stationId, date),
    day, keyed by station + date)         so re-importing is idempotent
```

## Why a monorepo with a separate engine package

The brief asks for a lot of surface area (12+ UI modules, reports, an
AI advisor) around a comparatively small, precise scientific core (the
FAO equations). Separating them means:

- The engine can be tested in isolation against the PDF's own worked
  examples, with no database or HTTP mocking required
- The same engine could power a future CLI, a batch job, or a mobile
  app without duplicating the maths
- API controllers stay thin: fetch data, convert types, call the
  engine, return JSON — the kind of code that's easy to review

## What's deliberately NOT abstracted

Given the scope, controllers call Prisma directly rather than going
through a repository layer, and there's no GraphQL/tRPC layer — just
REST + Zod. For a project this size that's the right amount of
architecture; introducing more layers would cost more than it returns
before there's a second consumer of the API.
