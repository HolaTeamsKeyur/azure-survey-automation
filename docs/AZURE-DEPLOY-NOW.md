# Azure deployment — next required phase

The solution does not work end to end without an Azure deployment. Before deployment, the Dynamics buttons only update Dataverse timestamps. Azure is required to receive the webhook, read regional products, schedule the survey, send the email and host the signed customer forms.

## 1. Values required

Obtain these values without placing secrets in chat or source control:

| Value | Example/meaning |
|---|---|
| Azure subscription | Approved HolaTeams development subscription |
| Resource group | Approved development resource group |
| Static Web App name | Globally unique, for example `a4l-survey-demo-dev` |
| Entra tenant ID | HolaTeams tenant GUID |
| Entra application/client ID | Application used by the API |
| Client secret value | Secret value, not its object/secret ID |
| Sender mailbox | Approved internal survey sender |
| Survey token secret | At least 32 random characters |
| Automation ingress key | At least 24 random characters |

## 2. Create the Entra application identity

1. Open **Microsoft Entra admin center** > **Identity** > **Applications** > **App registrations**.
2. Select **New registration**.
3. Name it **HolaTeams Survey Automation Dev**.
4. Select **Accounts in this organizational directory only**.
5. Leave Redirect URI blank and register.
6. Copy the **Application (client) ID** and **Directory (tenant) ID**.
7. Open **Certificates & secrets** > **New client secret**.
8. Use the shortest approved expiry and copy the secret **value** immediately.
9. Open **API permissions** > **Add a permission** > **Microsoft Graph** > **Application permissions**.
10. Add `Calendars.ReadBasic` and `Mail.Send`.
11. Grant admin consent.
12. Restrict Graph application access to the approved sender/surveyor mailboxes using the organisation's Exchange application-access/RBAC policy.

## 3. Create the Dataverse application user

1. Open **Power Platform admin center**.
2. Select **Environments** > **HolaTeams development**.
3. Open **Settings** > **Users + permissions** > **Application users**.
4. Select **New app user** and choose **HolaTeams Survey Automation Dev**.
5. Select the correct business unit.
6. Assign the least-privilege survey automation security role described in the Dataverse build guide.
7. Confirm it can read required Opportunity, Contact, Region, Product, Price List, Price List Item and user records; create Appointment; and update only required Opportunity/Order fields.

## 4. Create Azure Static Web Apps Free

Use either `infra/main.bicep` through Azure Cloud Shell/CLI or the portal.

Portal route:

1. Open **Azure portal** > **Create a resource** > **Static Web App**.
2. Select the approved subscription and resource group.
3. Enter the unique app name.
4. Plan type: **Free** for the demonstration.
5. Region: **West Europe**.
6. Deployment source: choose **GitHub**.
7. Sign in to GitHub and authorise Azure Static Web Apps for the approved organisation/repository.
8. Select the repository and deployment branch, normally `main`.
9. Under build details, choose **Custom** and use the paths in the next section.
10. Create the resource. Azure creates a workflow under `.github/workflows` and adds its deployment token as a GitHub repository secret.
11. On **Overview**, copy the generated hostname.

### GitHub build paths

If the GitHub repository root is the current **Node Application** folder:

```text
App location:    /azure-survey-automation/web
API location:    /azure-survey-automation
Output location: leave empty
```

If `azure-survey-automation` is its own GitHub repository:

```text
App location:    /web
API location:    /
Output location: leave empty
```

After Azure creates the workflow, verify the upload action contains the equivalent settings:

```yaml
with:
  azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_REPLACE_WITH_GENERATED_NAME }}
  repo_token: ${{ secrets.GITHUB_TOKEN }}
  action: upload
  app_location: azure-survey-automation/web
  api_location: azure-survey-automation
  output_location: ''
  skip_app_build: true
  api_build_command: npm run build
```

The example assumes the **Node Application** repository root. Keep the generated secret name instead of copying the placeholder. The frontend is plain static content, so its build is skipped; the managed Functions API is still built.

## 5. Add backend environment variables

Open the Static Web App > **Settings** > **Environment variables** > production environment. Add:

```text
DATAVERSE_URL=https://holateams-operations.crm.dynamics.com
GRAPH_SENDER_MAILBOX=<approved mailbox>
PUBLIC_BASE_URL=https://<generated-hostname>
AZURE_TENANT_ID=<tenant GUID>
AZURE_CLIENT_ID=<application GUID>
AZURE_CLIENT_SECRET=<client secret value>
SURVEY_TOKEN_SECRET=<32+ random characters>
AUTOMATION_INGRESS_KEY=<24+ random characters>
ENABLE_ACTIONABLE_MESSAGES=false
ACTIONABLE_APP_ID_URI=disabled
ACTIONABLE_ORIGINATOR_ID=disabled
ACTIONABLE_ALLOWED_TENANTS=
ACTIONABLE_ALLOW_GLOBAL_TENANTS=false
ENABLE_WORD_DOCUMENT=false
TEMPLATE_STORAGE_URL=
TEMPLATE_CONTAINER=document-templates
SURVEY_TEMPLATE_BLOB=survey/survey-template.docx
DEFAULT_SURVEY_DURATION_MINUTES=60
SURVEY_BUSINESS_START_HOUR=9
SURVEY_BUSINESS_END_HOUR=17
DEFAULT_TIME_ZONE=Europe/London
```

Keep Outlook cards and Word attachments disabled for the first deployment. The first milestone is a normal email containing the secure browser form.

## 6. Deploy the prepared application through GitHub

1. Commit the prepared project and Azure-generated workflow to a feature branch.
2. Open a pull request and confirm the build/test review process required by the repository.
3. Merge to the selected deployment branch.
4. Open GitHub **Actions** and watch the Azure Static Web Apps workflow.
5. Confirm the upload job finishes successfully.
6. In Azure, open the Static Web App and confirm the production environment shows the new deployment.

Do not place `AZURE_CLIENT_SECRET`, `SURVEY_TOKEN_SECRET`, `AUTOMATION_INGRESS_KEY` or other runtime secrets in the YAML file. Keep them in the Static Web App's production environment variables from section 5.

### Optional local deployment-token fallback

From PowerShell in `azure-survey-automation`:

```powershell
npm.cmd install
npm.cmd run check
$env:SWA_CLI_DEPLOYMENT_TOKEN = '<paste deployment token temporarily>'
npm.cmd run azure:deploy
Remove-Item Env:SWA_CLI_DEPLOYMENT_TOKEN
```

The deployment command publishes:

- the static landing page from `web`;
- the Node 20 managed Azure Functions API;
- the survey and installation forms;
- the Dataverse webhook receivers;
- Graph scheduling/email code.

## 7. Smoke test before registering a webhook

1. Open `https://<hostname>/`.
2. Open `https://<hostname>/api/health`.
3. Confirm the result contains `status: ok`.
4. Use an internal test recipient only.
5. Manually POST one test Opportunity GUID to `/api/events/opportunity-ready` with header `x-automation-key`.
6. Confirm the email arrives and the signed form opens.
7. Submit a response and confirm Opportunity fields update.
8. Repeat for one Order.

## 8. Only then register the Dataverse webhooks

Use these endpoints:

```text
https://<hostname>/api/events/opportunity-ready
https://<hostname>/api/events/installation-ready
```

Use header authentication name `x-automation-key` and the same value stored in Azure. Register asynchronous post-operation Update steps filtered only on the two request-timestamp fields. The full settings are in `DATAVERSE-MANUAL-EXECUTION-GUIDE.md`, section 14.

## 9. Features enabled later

After browser-form UAT succeeds:

1. Upload the approved Word template to private Blob Storage and set `ENABLE_WORD_DOCUMENT=true`.
2. Complete Outlook Actionable Message provider/Entra registration and then set `ENABLE_ACTIONABLE_MESSAGES=true`.
3. Retest using Outlook Web, new Outlook and supported desktop/mobile clients; the browser link remains the fallback.
