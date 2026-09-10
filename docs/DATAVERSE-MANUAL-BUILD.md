# Manual Dataverse build - separate demo solution

Create this in the HolaTeams development environment only.

## Solution

| Setting | Value |
|---|---|
| Display name | HolaTeams Survey Automation Demo |
| Unique name | `HolaTeamsSurveyAutomationDemo` |
| Publisher | Existing HolaTeams publisher (`ht`) |
| Version | `1.0.0.0` |
| Type | Unmanaged in development |

Do not add all table assets. Use **Add existing > Table > Select components** and add only the columns/forms listed below. Do not create a table.

## Opportunity columns

| Display name | Schema name | Type | Length/behaviour | Form behaviour |
|---|---|---|---|---|
| Survey Automation Status | `ht_SurveyAutomationStatusKey` | Single line text | 50 | Read-only |
| Survey Recipient Email | `ht_SurveyRecipientEmail` | Email | 200 | Read-only |
| Survey Response Expires At | `ht_SurveyExpiresAt` | Date and time | Time-zone independent | Read-only |
| Survey Token ID | `ht_SurveyTokenId` | Single line text | 100 | Do not place on normal user form |
| Survey Allowed Product IDs | `ht_SurveyAllowedProductIds` | Multiple lines text | 100,000 | Hidden/read-only |
| Survey Products Snapshot | `ht_SurveyProductsSnapshotJson` | Multiple lines text | 1,000,000 | Hidden/read-only |
| Survey Selected Product IDs | `ht_SurveySelectedProductIds` | Multiple lines text | 100,000 | Read-only |
| Survey Response Reason | `ht_SurveyResponseReason` | Multiple lines text | 4,000 | Read-only |
| Survey Feedback Score | `ht_SurveyFeedbackScore` | Whole number | Min 1, max 5 | Read-only |
| Survey Feedback Comments | `ht_SurveyFeedbackComments` | Multiple lines text | 4,000 | Read-only |
| Survey Responded On | `ht_SurveyRespondedOn` | Date and time | User local | Read-only |
| Survey Automation Last Error | `ht_SurveyAutomationLastError` | Multiple lines text | 4,000 | Admin form only |

Existing Opportunity columns used by the automation—do not recreate them:

- `parentcontactid`
- `ht_region`
- `ht_surveyor`
- `ht_surveystart`
- `ht_surveyfinish`
- `ht_surveyeventid`
- `ht_operationalstage`
- `ht_propertypostcode`
- `ht_streetname`
- `pricelevelid`

## Order Confirmation columns

Order Confirmation is the standard Sales Order table.

| Display name | Schema name | Type | Length/behaviour | Form behaviour |
|---|---|---|---|---|
| Installation Customer Response | `ht_InstallationResponseKey` | Single line text | 50 | Read-only |
| Installation Recipient Email | `ht_InstallationRecipientEmail` | Email | 200 | Read-only |
| Installation Response Expires At | `ht_InstallationResponseExpiresAt` | Date and time | Time-zone independent | Read-only |
| Installation Response Token ID | `ht_InstallationResponseTokenId` | Single line text | 100 | Do not place on normal user form |
| Installation Response Reason | `ht_InstallationResponseReason` | Multiple lines text | 4,000 | Read-only |
| Installation Responded On | `ht_InstallationRespondedOn` | Date and time | User local | Read-only |

Existing Order columns used—do not recreate them:

- `ht_customercontact`
- `ht_region`
- `ht_installationstart`
- `ht_installationfinish`
- `ht_installationstatus`

## Form changes

### Opportunity form

Add a collapsed section named **Customer Survey Automation** below the existing Survey Details section:

1. Survey Automation Status
2. Survey Recipient Email
3. Survey Response Expires At
4. Survey Selected Product IDs
5. Survey Response Reason
6. Survey Feedback Score
7. Survey Feedback Comments
8. Survey Responded On

Keep all fields read-only for ordinary sales users. Do not display token ID, allowed IDs, snapshot JSON or last error on the normal form.

### Order Confirmation form

Add a section named **Customer Installation Confirmation** below Installation Details:

1. Installation Customer Response
2. Installation Recipient Email
3. Installation Response Expires At
4. Installation Response Reason
5. Installation Responded On

Keep them read-only for ordinary users.

## Security and auditing

- Enable auditing on every visible response field and the two expiry/token-ID fields.
- Add field security for token ID, product IDs/snapshot and last error.
- Automation application user needs read/write for these Opportunity/Order columns and read access to Contact, Region, Account, Product, Price List and Price List Item.
- Do not give the application delete permission on Opportunity or Order Confirmation.

## Trigger integration - create after the Azure URL exists

### Recommended no-premium demonstration trigger: Dataverse webhooks

The API accepts the standard Dataverse `RemoteExecutionContext`, so no paid HTTP action in Power Automate is required.

In the Microsoft Plug-in Registration Tool, register two HTTPS webhooks. For each webhook choose **HttpHeader** authentication and add:

```text
x-automation-key: <same random secret as the Azure AUTOMATION_INGRESS_KEY setting>
```

Register these asynchronous, post-operation steps:

| Webhook endpoint | Message | Primary table | Filtering attributes | Purpose |
|---|---|---|---|---|
| `/api/events/opportunity-ready` | Create | Opportunity | Not applicable | Schedule and email after qualification creates the Opportunity |
| `/api/events/installation-ready` | Update | Order (`salesorder`) | `ht_installationstart,ht_installationfinish` | Email after both installation dates are saved |

For development, select **Delete AsyncOperation if StatusCode = Successful**. Test only with an internal recipient first. The endpoints reject a webhook whose `x-ms-dynamics-entity-name` does not match the expected table.

If the qualifying process creates the Opportunity before Contact, Region, Surveyor or Price List is populated, do not use the Create step yet. Register an Opportunity Update step on the final readiness field instead, or use the manual request below for the demonstration. Do not register broad Update steps without filtering attributes.

After registration, add the Service Endpoint and SDK Message Processing Steps as existing components to `HolaTeams Survey Automation Demo`; do not add unrelated components.

### Manual smoke-test requests

Opportunity trigger body:

```json
{ "opportunityId": "<Opportunity GUID>" }
```

Endpoint: `POST https://<static-web-app>/api/events/opportunity-ready`

Order trigger body:

```json
{ "orderId": "<Sales Order GUID>" }
```

Endpoint: `POST https://<static-web-app>/api/events/installation-ready`

Both requests require the `x-automation-key` header. Use manual requests first to avoid accidental customer sends, then enable the asynchronous webhook steps.

## Completion check

- Solution contains zero new tables.
- No new Region identifier exists.
- Opportunity and Order form sections publish successfully.
- Columns appear in the Web API using their lowercase logical names.
- A test user cannot edit secured automation fields.
