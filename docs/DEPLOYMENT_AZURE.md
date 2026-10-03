# Deployment architecture: Microsoft Azure

This describes the target architecture; it has not been provisioned in
this environment (no Azure access here). Everything below uses
standard, low-maintenance Azure PaaS services appropriate for a
two-service (API + web) app with a Postgres database. It matches
`.github/workflows/deploy.yml` in this repo exactly -- follow this doc
and that workflow deploys without modification.

```
                         +----------------------------+
 Browser  ------------->  | Azure App Service            |  apps/web (Next.js,
                          | (Linux, Node 20 runtime)      |  `next build`+`next start`)
                          +--------------+-------------+
                                         | HTTPS (custom domain, free cert)
                                         v
                          +----------------------------+
                          | Azure App Service            |  apps/api (Express,
                          | (Linux, Node 20 runtime)      |  Node 20)
                          +--------------+-------------+
                                         | 
                                         v
                          +----------------------------+
                          | Azure Database for            |  managed Postgres,
                          | PostgreSQL Flexible Server     |  automated backups
                          +----------------------------+

 Azure Key Vault    --> App Service app settings (DATABASE_URL, JWT_SECRET)
 Azure Blob Storage --> (roadmap) generated PDF/Excel/CSV reports
 Application Insights --> App Service diagnostics/logging
```

## Why App Service for both, and not Static Web Apps for the web app

Azure Static Web Apps' "hybrid" Next.js build preset has historically
been finicky for App Router projects, and debugging a managed build
preset you don't control is a bad use of time for a first deployment.
Plain `next build` + `next start` on a second App Service instance is
predictable and uses the exact same deploy mechanism as the API, so
there's only one pattern to learn. Revisit Static Web Apps later if
its global edge CDN becomes worth the trade-off.

## Why App Service over AKS/Container Apps for v1

Two stateless Node services and one managed database is exactly the
case Azure App Service is built for -- no cluster to operate, built-in
deploy slots for zero-downtime releases, and it's the cheapest option
that still gives autoscale. Move to Azure Container Apps later if you
need background workers (e.g. an async report-generation queue).

## Resource provisioning (Azure CLI)

```bash
az login
az group create -n cwr-rg -l southafricanorth

# Managed Postgres
az postgres flexible-server create \
  -g cwr-rg -n cwr-pg --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 --version 16 --admin-user cwradmin
az postgres flexible-server db create -g cwr-rg -s cwr-pg -d cwr_prod
# Allow Azure services (App Service) to reach Postgres:
az postgres flexible-server firewall-rule create -g cwr-rg -n cwr-pg \
  --rule-name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
# Allow your own machine too, so you can run `prisma migrate deploy` from your laptop:
az postgres flexible-server firewall-rule create -g cwr-rg -n cwr-pg \
  --rule-name AllowMyIP --start-ip-address <your-ip> --end-ip-address <your-ip>

# One App Service plan, two Web Apps on it
az appservice plan create -g cwr-rg -n cwr-plan --is-linux --sku B1

az webapp create -g cwr-rg -p cwr-plan -n cwr-api --runtime "NODE:20-lts"
az webapp config appsettings set -g cwr-rg -n cwr-api --settings \
  DATABASE_URL="postgresql://cwradmin:<password>@cwr-pg.postgres.database.azure.com:5432/cwr_prod?sslmode=require" \
  JWT_SECRET="<generate a long random string>" \
  CORS_ORIGIN="https://cwr-web.azurewebsites.net" \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false

az webapp create -g cwr-rg -p cwr-plan -n cwr-web --runtime "NODE:20-lts"
az webapp config appsettings set -g cwr-rg -n cwr-web --settings \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

`SCM_DO_BUILD_DURING_DEPLOYMENT=false` matters: the GitHub Actions
workflow already builds everything and ships only production
dependencies, so letting App Service's Oryx builder try to rebuild on
the server (it would try to run `npm run build`, which needs devDeps
we deliberately stripped out) just fails or wastes time.

Get each app's publish profile for the GitHub secrets below:

```bash
az webapp deployment list-publishing-profiles -g cwr-rg -n cwr-api --xml > api-publish-profile.xml
az webapp deployment list-publishing-profiles -g cwr-rg -n cwr-web --xml > web-publish-profile.xml
```

## GitHub repository secrets

Add these under Settings -> Secrets and variables -> Actions:

| Secret | Value |
|---|---|
| `DATABASE_URL` | the same Postgres connection string used above |
| `AZURE_API_PUBLISH_PROFILE` | contents of `api-publish-profile.xml` |
| `AZURE_WEB_PUBLISH_PROFILE` | contents of `web-publish-profile.xml` |
| `NEXT_PUBLIC_API_URL` | `https://cwr-api.azurewebsites.net` |

## Deploy

Push to `main` (or run the workflow manually from the Actions tab) --
`.github/workflows/deploy.yml` builds `packages/fao-engine`, generates
the Prisma client, runs `prisma migrate deploy` against the live
database, builds both apps, and zip-deploys each to its App Service.

Then run the seed script once, from your own machine, against the
live database:

```bash
DATABASE_URL="<the Azure connection string>" npm run prisma:seed --workspace=apps/api
```

## Secrets hardening (after the first successful deploy)

Move `DATABASE_URL` and `JWT_SECRET` into Azure Key Vault and reference
them from App Service application settings as Key Vault references
(`@Microsoft.KeyVault(SecretUri=...)`) instead of plain app settings.
Not required to get a first deploy live, worth doing before real data
goes in.

## Roadmap items this doesn't yet cover

- Blob Storage wiring for the report-export feature (not built yet --
  see `ROADMAP.md`)
- A queue (Azure Service Bus / Storage Queue) if report generation or
  the AI advisor need background processing
- Autoscale rules (start with App Service's built-in CPU-based
  autoscale; revisit once you know real traffic patterns)
