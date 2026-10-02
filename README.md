# CWR & Intelligent Irrigation Scheduler

A crop water requirement and irrigation scheduling web application built
strictly to the methodology in **FAO Irrigation Manual Module 4: Crop
Water Requirements and Irrigation Scheduling**.

Weather ingestion is built around the exact column structure of the
uploaded `MET_DATA.xlsx` (Nchalo Factory daily meteorological export).

## What's actually working right now

This is a real, running codebase, not a mockup — everything below has
been installed, type-checked, and (for the calculation engine) unit
tested against worked examples pulled directly from the PDF and against
2,100 real days of your MET_DATA.xlsx.

| Layer | Status |
|---|---|
| `packages/fao-engine` — all FAO Module 4 calculations | **Done, 32/32 tests passing** |
| `apps/api` — Express + PostgreSQL REST API | **Done, compiles clean** (see note below on generating the Prisma client) |
| `apps/web` — Next.js dashboard, calculators, charts | **Done, builds clean** |
| AI Advisory Assistant (Module list item 12) | **Not built** — see `ROADMAP.md` |
| PDF/Excel/CSV report export (Module 15) | **Not built** — see `ROADMAP.md` |
| Multi-season comparison views | **Not built** — see `ROADMAP.md` |
| Azure deployment | **Documented, not deployed** — see `docs/DEPLOYMENT_AZURE.md` |

A genuinely production-grade version of everything in the original
16-module brief (with polished UI for every module, full report
exports, a working AI copilot, Azure infra actually stood up) is weeks
of work, not one build. What's here is the real engineering core — the
part that has to be scientifically correct — fully implemented and
verified, plus a working full-stack app on top of it you can run today
and extend.

## One thing you'll need to do yourself

This sandbox's network access doesn't reach Prisma's engine-binary
host, so `prisma generate` / `migrate` couldn't be run here. The
schema (`apps/api/prisma/schema.prisma`) is complete and was verified
with a temporary type stub, but you'll need to run the real
`npm run prisma:generate` yourself (see Setup below) once this is on a
machine with normal internet access — it's a one-command step.

## Folder structure

```
cwr/
├── packages/
│   └── fao-engine/        # Pure TypeScript FAO Module 4 calculation engine
│       ├── src/            et0.ts, growthStage.ts, etc.ts, soilWaterBalance.ts,
│       │                   effectiveRainfall.ts, irrigationRequirement.ts,
│       │                   irrigationScheduler.ts, yieldResponse.ts,
│       │                   cropData.ts, soilTextures.ts, metParser.ts
│       └── test/           32 tests, incl. MET_DATA.xlsx cross-validation
├── apps/
│   ├── api/                # Express + PostgreSQL + JWT REST API
│   │   ├── prisma/         schema.prisma, seed.ts
│   │   └── src/            routes/, controllers/, services/, middleware/
│   └── web/                # Next.js 14 + Tailwind + Recharts frontend
│       └── src/app/        /, /login, /register, /setup, /et0, /plantings/[id]
└── docs/                   ARCHITECTURE.md, API_DESIGN.md, DEPLOYMENT_AZURE.md,
                             DATA_NOTES.md, ROADMAP.md
```

## Setup

Prerequisites: Node.js >= 18.18, a PostgreSQL 14+ database.

```bash
# 1. Install everything (npm workspaces)
npm install

# 2. Build and test the calculation engine
npm run test --workspace=packages/fao-engine

# 3. Configure the API
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env: DATABASE_URL, JWT_SECRET

# 4. Generate the Prisma client and create the database schema
npm run prisma:generate --workspace=apps/api
npm run prisma:migrate --workspace=apps/api -- --name init

# 5. Seed crop reference data + a demo farm/field/planting
npm run prisma:seed --workspace=apps/api

# 6. Configure the web app's API URL
cp apps/web/.env.local.example apps/web/.env.local

# 7. Run the API and web app (two terminals)
npm run dev:api
npm run dev:web
```

Then open http://localhost:3000, log in with the seeded demo account
(`demo@cwr.local` / `Demo1234!`), open the demo planting, and upload
`MET_DATA.xlsx` to see the dashboard, Kc curve, soil water balance and
irrigation schedule populate from real data.

## Documentation

- `docs/ARCHITECTURE.md` — system architecture, component hierarchy, engines
- `docs/API_DESIGN.md` — full endpoint reference
- `docs/DATA_NOTES.md` — MET_DATA.xlsx data-quality findings, and every
  place a value was assumed rather than taken directly from the PDF
  (soil AWC table, station coordinates, Kc/stage-length picks, etc.)
- `docs/DEPLOYMENT_AZURE.md` — deployment architecture for Azure
- `ROADMAP.md` — what's built, what's next, and suggested priority order
