# Legacy Azure Static Web Apps Free demo setup

This Free-plan procedure is superseded for production. The surveyor workflow uses Standard with a custom, single-tenant Entra provider; follow `PRODUCTION-SURVEY-RUNBOOK.md`.

This is the selected no-additional-Dynamics-module host for the demonstration. GitHub Actions is the preferred deployment route; the local deployment-token command is a fallback.

## Repository paths

If the repository root is `Node Application`, configure:

| Setting | Value |
|---|---|
| App location | `azure-survey-automation/web` |
| API location | `azure-survey-automation` |
| Output location | `.` (relative to the app location) |
| API runtime | Node.js 20 |

`web/staticwebapp.config.json` declares Node 20 and public `/api/*` routes. Every sensitive API operation still performs its own signed-token or ingress-key validation.

When running the Static Web Apps CLI from the `azure-survey-automation` directory, `swa-cli.config.json` resolves the equivalent paths as `web`, `.`, and `.`. Do not change its output location to `web`, because output is relative to app location and would resolve as `web/web`.

## Create the Azure resource

The Free resource definition is in `infra/main.bicep`. Do not put real secrets in `main.parameters.example.json`.

Example after Azure CLI is installed and the correct subscription is selected:

```powershell
az deployment group what-if `
  --resource-group <approved-development-resource-group> `
  --template-file infra/main.bicep `
  --parameters @infra/main.parameters.local.json
```

Review `what-if` before `az deployment group create`. Keep `main.parameters.local.json` outside source control.

## Required API application settings

- `DATAVERSE_URL`
- `GRAPH_SENDER_MAILBOX`
- `PUBLIC_BASE_URL`
- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `SURVEY_TOKEN_SECRET`
- `AUTOMATION_INGRESS_KEY`
- `DEFAULT_SURVEY_DURATION_MINUTES`
- `SURVEY_BUSINESS_START_HOUR`
- `SURVEY_BUSINESS_END_HOUR`
- `DEFAULT_TIME_ZONE`

For the first demo:

```text
ENABLE_ACTIONABLE_MESSAGES=false
ENABLE_WORD_DOCUMENT=false
```

This sends a normal branded HTML email with the secure public link. It avoids blocking the demonstration on provider registration or template storage.

## Application identity

Create one single-tenant Entra application and one Dataverse application user with the custom role described in `DATAVERSE-MANUAL-BUILD.md`.

Microsoft Graph application permissions:

- `Calendars.ReadBasic`
- `Mail.Send`

Grant admin consent and restrict the app to approved mailboxes through Exchange application RBAC/access policy.

For the Free managed API, `DefaultAzureCredential` reads `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET`. Rotate the secret after the demo. Production should use a hosting option with managed identity or certificate authentication.

## First smoke test

1. Open `https://<host>/` and confirm the Access4Lofts landing page.
2. Call `GET https://<host>/api/health`.
3. Restrict the recipient on the test Opportunity to an internal mailbox.
4. Call the Opportunity ingress endpoint with its key.
5. Open the emailed signed link in a private browser.
6. Submit Accept and verify Opportunity response fields.
7. Repeat for Order Confirmation.

After both manual tests pass, follow the Dataverse webhook registration in `DATAVERSE-MANUAL-BUILD.md`. This avoids relying on a premium Power Automate HTTP action for the demonstration.

## Deployment-token route after the resource exists

The project invokes a pinned Static Web Apps CLI version only for deployment rather than adding its large toolchain to the application's installed dependencies. From the `azure-survey-automation` directory:

```powershell
$env:SWA_CLI_DEPLOYMENT_TOKEN = '<paste from Azure portal; do not save it in a file>'
npm.cmd run azure:deploy
Remove-Item Env:SWA_CLI_DEPLOYMENT_TOKEN
```

Get the token from **Azure portal > Static Web App > Overview > Manage deployment token**. The command runs the build and tests before deploying both `web` and the managed Functions API. Never paste the token into chat, source control or `local.settings.json`.

## Limitations

- Free plan has no SLA.
- Managed API calls have a 45-second limit.
- Only HTTP-triggered APIs are used.
- Automatic retries/queues and WAF are deferred.
- Actionable Messages require separate provider/Entra configuration.
- Word attachment remains disabled until an approved template/storage decision exists.
