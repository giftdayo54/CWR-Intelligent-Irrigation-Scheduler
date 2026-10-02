# Roadmap

## Done in this build

- **Calculation engine** (`packages/fao-engine`): ET0 (Penman-Monteith +
  Class A pan), smart crop database (19 crops), auto growth-stage
  engine, dynamic Kc + root-depth curves, ETc, USDA effective rainfall,
  net/gross irrigation requirement, irrigation frequency + scheduling,
  FAO Ky yield response, MET_DATA.xlsx parser. 32 tests, validated
  against the PDF's own worked examples and against your real weather
  data.
- **API** (`apps/api`): auth, farms/fields/weather stations, crop
  database + custom crops, plantings, weather import, ET0 calculator,
  irrigation calculators + scheduler, yield response. Database schema
  covers every entity the above needs.
- **Web app** (`apps/web`): auth flow, guided setup wizard, Farm
  Dashboard widget, Kc/root-depth chart, soil-water-balance chart,
  irrigation schedule table, yield response panel, standalone ET0
  calculator.

## Suggested next priorities

Roughly in the order they'd add the most value:

1. **Run it for real**: `prisma generate` + `migrate` against a real
   Postgres instance, import your actual MET_DATA.xlsx, and sanity
   check the dashboard/schedule against what you'd expect for a real
   sugarcane block. This will surface any remaining rough edges faster
   than anything else on this list.
2. **Reconcile the two effective-rainfall paths** (`/balance` uses
   monthly USDA distributed daily; `/schedule` uses a flat 80%
   assumption — see `docs/DATA_NOTES.md`). Pick one daily method and
   use it consistently, or formalize the flat-percentage one as the
   documented "fast" mode.
3. **Report export (Module 15)**: PDF/Excel/CSV generation. The `pdf`
   and `xlsx` skills already handle document generation well — this is
   mostly plumbing: a report-definition endpoint that gathers
   dashboard + season-series + schedule + yield data for a planting and
   feeds it to a template.
4. **Multi-field / multi-season comparison views**: the schema already
   supports many plantings per field and many fields per farm; this is
   a web-app-only addition (comparison charts across `Planting` rows).
5. **AI Advisory Assistant (Module 12)**: needs a product decision
   before implementation — which model/API, cost model (per-request vs.
   subscription), and how much of the dashboard context to feed it.
   Once decided, it's a thin endpoint that assembles the same context
   `getDashboard` already computes and sends it to the chosen LLM with
   a system prompt scoped to irrigation advice.
6. **Auth hardening**: refresh tokens (current JWTs are long-lived
   access tokens only), rate limiting on `/api/auth/*`, and email
   verification if this goes further than internal/pilot use.
7. **Azure deployment**: provision the resources in
   `docs/DEPLOYMENT_AZURE.md` and wire the GitHub Actions workflow.
8. **UI polish pass**: the current screens are functional, not
   designed — real spacing/typography/empty-states work once the
   information architecture has settled from real use.

## Explicitly out of scope for now (and why)

- **AI Advisory Assistant**: building a stub with no real integration
  would look done without being useful — better to make the product
  decision first (see #5 above).
- **Full UI wireframes as a separate deliverable**: the built pages
  are the real, working version of what wireframes would have shown;
  a separate wireframe pass would duplicate that effort without adding
  information.
