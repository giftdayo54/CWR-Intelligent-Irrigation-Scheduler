# Deployment architecture: Microsoft Azure

This describes the target architecture; it has not been provisioned in
this environment (no Azure access here). Everything below uses
standard, low-maintenance Azure PaaS services appropriate for a
two-service (API + web) app with a Postgres database.

```
                         ┌───────────────────────────┐
 Browser  ─────────────▶ │ Azure Static Web Apps        │  apps/web (Next.js,
                         │ or App Service (Linux, Node) │  static-exported or
                         └──────────────┬────────────┘  Node runtime)
                                        │ HTTPS (custom domain, free cert)
                                        ▼
                         ┌───────────────────────────┐
                         │ Azure App Service            │  apps/api (Express,
                         │ (Linux, Node 20 runtime)      │  Node 20)
                         └──────────────┬────────────┘
                                        │ private VNet integration
                                        ▼
                         ┌───────────────────────────┐
                         │ Azure Database for            │  managed Postgres,
                         │ PostgreSQL Flexible Server     │  automated backups
                         └───────────────────────────┘

 Azure Key Vault  ──▶ App Service app settings (DATABASE_URL, JWT_SECRET)
 Azure Blob Storage ──▶ (roadmap) generated PDF/Excel/CSV reports
 Application Insights ──▶ App Service diagnostics/logging
```

## Why App Service over AKS/Container Apps for v1

Two stateless Node services and one managed database is exactly the
case Azure App Service is built for — no cluster to operate, built-in
deploy slots for zero-downtime releases, and it's the cheapest option
that still gives autoscale. Move to Azure Container Apps if you later
need background workers (e.g. an async report-generation queue) —
the Dockerfiles below work unchanged for either.

## Resource provisioning (Azure CLI outline)

```bash
az group create -n cwr-rg -l southafricanorth

# Managed Postgres
az postgres flexible-server create \
  -g cwr-rg -n cwr-pg --tier Burstable --sku-name Standard_B1ms \
  --storage-size 32 --version 16 --admin-user cwradmin

az postgres flexible-server db create -g cwr-rg -s cwr-pg -d cwr_prod

# API
az appservice plan create -g cwr-rg -n cwr-plan --is-linux --sku B1
az webapp create -g cwr-rg -p cwr-plan -n cwr-api --runtime "NODE:20-lts"
az webapp config appsettings set -g cwr-rg -n cwr-api --settings \
  DATABASE_URL="<from Key Vault>" JWT_SECRET="<from Key Vault>" \
  CORS_ORIGIN="https://cwr-web.azurestaticapps.net"

# Web (Static Web Apps, connected to your GitHub repo)
az staticwebapp create -g cwr-rg -n cwr-web \
  --source <github-repo-url> --branch main \
  --app-location "apps/web" --output-location ".next"
```

## Secrets

Put `DATABASE_URL` and `JWT_SECRET` in Azure Key Vault and reference
them from App Service application settings as Key Vault references
(`@Microsoft.KeyVault(SecretUri=...)`) rather than pasting raw values
into app settings.

## CI/CD (GitHub Actions sketch)

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build --workspace=packages/fao-engine
      - run: npm run prisma:generate --workspace=apps/api
      - run: npm run build --workspace=apps/api
      - uses: azure/webapps-deploy@v3
        with:
          app-name: cwr-api
          package: apps/api
          publish-profile: ${{ secrets.AZURE_API_PUBLISH_PROFILE }}
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_TOKEN }}
          app_location: apps/web
          output_location: .next
```

## Database migrations in production

Run `npx prisma migrate deploy` (not `migrate dev`) as a one-off
release step — either as a GitHub Actions job before the App Service
deploy step, or as an App Service deployment "run command" hook.

## Roadmap items this doesn't yet cover

- Blob Storage wiring for the report-export feature (not built yet —
  see `ROADMAP.md`)
- A queue (Azure Service Bus / Storage Queue) if report generation or
  the AI advisor need background processing
- Autoscale rules (start with App Service's built-in CPU-based
  autoscale; revisit once you know real traffic patterns)
