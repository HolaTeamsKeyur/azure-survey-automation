# Production surveyor workflow runbook

## Target transaction

`Lead -> qualified Opportunity -> surveyor assigned -> authenticated survey form -> Opportunity Products / Product Requests -> reviewed draft Quote -> Order -> customer installation confirmation`

The property survey belongs to the internal surveyor. The later installation confirmation belongs to the customer. They use separate recipients and separate security rules.

## 1. Microsoft identity and permissions

### Existing backend app registration

The existing Dataverse application user is the non-interactive backend identity. For the workflow in this runbook it needs **no Microsoft Graph application permissions**.

In Entra admin centre, open **App registrations > HolaTeams Survey Automation > API permissions** and remove:

- `Calendars.ReadBasic.All` / `Calendars.ReadBasic`
- `Mail.Send`

Power Automate sends mail through its Office 365 Outlook connection. Dataverse API access is authorised by the Dataverse Application User and its security role, not by a Microsoft Graph permission.

`Calendars.ReadBasic` is needed only if a later requirement explicitly asks the backend to search surveyor free/busy time. App-only calendar permission is tenant-wide by default and must then be restricted to a surveyor mailbox group with Exchange Application RBAC. Keep `ENABLE_AUTO_SCHEDULING=false` now.

Rotate the previously used client secret before production and store only the new value in Azure configuration/Key Vault. Never put it in Power Automate, source control, chat, screenshots, or documentation.

### Surveyor interactive sign-in on the Free plan

Keep `a4l-survey-dev` on Azure Static Web Apps Free and use its preconfigured Microsoft Entra provider. No second app registration or surveyor-portal client secret is required.

The email link first opens `/.auth/login/aad` and returns to the signed survey URL. Although the Free provider can display sign-in for Microsoft accounts outside HolaTeams, the API independently validates all three controls: a signed survey token, the HolaTeams Entra tenant ID from `AZURE_TENANT_ID`, and the signed-in email matching the Opportunity's assigned Surveyor internal email. An outside account, another employee, or a forwarded link is rejected.

This keeps hosting free during development and UAT. A separate single-tenant custom provider remains an optional Standard-plan hardening step before a future production SLA decision; it is not required for the current build.

## 2. Dataverse application-user role

Create/adjust one custom role named `A4L Survey Automation Service` and assign it only to the backend Application User.

Minimum privileges:

- Organisation read: Account, Contact, Product, Unit, Price List, Price List Item, Transaction Currency, System User.
- Organisation read/write: Opportunity.
- Organisation create/read/write: Opportunity Product, Quote, Quote Product, Survey Product Request.
- Organisation read: Region and Survey Template custom tables.
- Append/Append To where required by Opportunity/Product/Unit relationships.
- Permission to invoke `GenerateQuoteFromOpportunity` through the normal Dataverse API.

Surveyors do not need this service role. They authenticate to the web app; the backend performs tightly scoped Dataverse operations.

## 3. Create the Survey Product Request table

In `make.powerapps.com`, choose the HolaSales Operations environment and the existing solution:

1. **New > Table > Table**.
2. Display name `Survey Product Request`; plural `Survey Product Requests`.
3. Primary name column display name `Name`, schema `ht_Name`, maximum 200.
4. Create the table, then add the following columns exactly:

| Display name | Schema name | Type |
|---|---|---|
| Opportunity | `ht_Opportunity` | Lookup to Opportunity, Business required |
| Source Key | `ht_SourceKey` | Text, 450, Business required |
| Surveyor | `ht_Surveyor` | Lookup to User, Business required |
| Description | `ht_Description` | Multiple lines, 2,000 |
| Quantity | `ht_Quantity` | Decimal, precision 3, minimum 0.001 |
| Unit | `ht_UnitName` | Text, 100 |
| Estimated Unit Price | `ht_EstimatedUnitPrice` | Currency |
| Justification | `ht_Justification` | Multiple lines, 1,000 |
| Status Key | `ht_StatusKey` | Text, 50, required, default `pending` |
| Approved Product | `ht_ApprovedProduct` | Lookup to Product |
| Approved Unit | `ht_ApprovedUnit` | Lookup to Unit |
| Approved Unit Price | `ht_ApprovedUnitPrice` | Currency |
| Review Comments | `ht_ReviewComments` | Multiple lines, 2,000 |

5. Under **Keys**, add alternate key `AK Survey Product Request Source` using `Source Key`. This makes retries idempotent and prevents duplicate requests.
6. Add views `Pending Product Requests` (`Status Key = pending`) and `All Product Requests`.
7. Create a main form with sections **Request**, **Approval mapping**, and **Audit**. Make Opportunity, Surveyor, request details read-only for the approver; Approved Product, Approved Unit, Approved Unit Price, Status Key and Review Comments editable. Keep Source Key off the form.
8. Add a Survey Product Requests subgrid to the Opportunity form.
9. Add the table to the HolaSales model-driven app under a `Survey Configuration` area.
10. Publish all customisations and wait until the alternate key shows Active.

The API expects entity set `ht_surveyproductrequests` and lookup navigation names `ht_Opportunity` and `ht_Surveyor`. Verify these in the table's **Tools > Copy set name** / relationship properties. If the publisher generated different navigation names, update the two `@odata.bind` keys in `src/infrastructure/dataverse.ts` before enabling the feature.

## 4. Create configurable Survey Templates

Create table `Survey Template` (plural `Survey Templates`) with primary column `ht_Name`, then add:

| Display name | Schema name | Type |
|---|---|---|
| Region | `ht_Region` | Lookup to Region, optional |
| Definition JSON | `ht_DefinitionJson` | Multiple lines, 100,000, required |
| Version | `ht_Version` | Whole number, minimum/default 1 |
| Is Default | `ht_IsDefault` | Yes/No, default No |

Add the table to the `Survey Configuration` area. Create one default active record with `Is Default = Yes` and this definition:

```json
{
  "version": 1,
  "title": "Property survey",
  "sections": [
    { "key": "job", "title": "Job details", "helpText": "Information from Dynamics 365", "visible": true },
    { "key": "property", "title": "Property", "visible": true },
    { "key": "measurements", "title": "Measurements", "visible": true },
    { "key": "notes", "title": "Plan and notes", "visible": true },
    { "key": "products", "title": "Products", "visible": true },
    { "key": "new_products", "title": "Product not listed?", "visible": true },
    { "key": "review", "title": "Review and submit", "visible": true }
  ]
}
```

A Region-specific active template overrides the default. Administrators can safely reorder, rename, show or hide known sections; arbitrary HTML or JavaScript is never accepted. Keep `review` present. This is the supported layout configuration point; a drag-and-drop designer can be added later without changing the data contract.

## 5. Opportunity and regional catalogue

On the Opportunity main form require:

- Contact
- Region
- Surveyor (lookup to User)
- Survey Start and Survey Finish
- Price List, or Region/Franchise with a Default Price List
- `Send Survey Requested On` command field used by the command-bar button

For each regional Price List Item, set `Show in Customer Survey = Yes` (the legacy schema name is retained) and complete display order, survey description, display price text and indicative-price flag. Despite the legacy field name, the catalogue is now shown to the surveyor.

## 6. Power Automate: send the surveyor link

Edit Flow 1 as follows:

1. Trigger: Dataverse **When a row is added, modified or deleted**; Change type `Modified`; Table `Opportunities`; Scope `Organisation`; Select columns `ht_surveysendrequestedon`; Filter `ht_surveysendrequestedon ne null`.
2. HTTP POST to `https://kind-sea-0609d7210.3.azurestaticapps.net/api/events/opportunity-ready`.
3. Headers: `Content-Type = application/json`; `x-automation-key` from a secure Solution environment variable.
4. Body:

```json
{
  "opportunityId": "@{triggerOutputs()?['body/opportunityid']}"
}
```

5. Parse JSON with the existing response schema (`formUrl`, `recipientEmail`, `recipientName`, `subject`, `sessionId`, `reused`).
6. Office 365 Outlook **Send an email (V2)**: To = `recipientEmail`; Subject = `subject`; body:

```html
<p>Hello @{body('Parse_JSON')?['recipientName']},</p>
<p>You have been assigned an Access4Lofts property survey.</p>
<p><a href="@{body('Parse_JSON')?['formUrl']}">Open property survey</a></p>
<p>Sign in using this same Microsoft 365 account. Do not forward this survey link.</p>
```

7. Trigger concurrency = On, degree 1. Add a trigger condition or command logic so an unchanged request timestamp cannot create duplicate sends.

The API response now resolves recipient details from the assigned Dynamics System User, not the Contact.

## 7. Power Automate: approve requested products and release the Quote

Create `A4L - Product Request - Release Quote`:

1. Trigger on Survey Product Request modified; Select columns `ht_statuskey,ht_approvedproduct,ht_approvedunit,ht_approvedunitprice`; Filter rows `ht_statuskey eq 'approved'`.
2. Validate Approved Product, Approved Unit and Approved Unit Price are present. If not, terminate Failed with a clear message.
3. Get the related Opportunity.
4. List Opportunity Products filtered by the related Opportunity and Approved Product. Update quantity/price if found; otherwise add an Opportunity Product using the approved Product, Unit, Quantity and Unit Price.
5. List Survey Product Requests for that Opportunity where `ht_statuskey eq 'pending'`. Continue only when the returned count is zero.
6. List Quotes for the Opportunity, top count 1. If none exists, run Dataverse unbound action `GenerateQuoteFromOpportunity` with the Opportunity ID.
7. Update Opportunity `Survey Product Review Status Key = applied`.
8. Set concurrency to 1. Use a duplicate check before creating both the Opportunity Product and Quote.

Rejected requests use `ht_statuskey = rejected`; an office user must either replace them with a catalogue selection or explicitly decide that the Quote can proceed. Do not auto-create the global Product master from free text.

## 8. Azure production settings

Set these before enabling the flows:

```text
SEND_SURVEY_EMAIL=false
SEND_INSTALLATION_EMAIL=false
CREATE_QUOTE_ON_SUBMIT=true
ENABLE_AUTO_SCHEDULING=false
REQUIRE_SURVEYOR_AUTH=true
ENABLE_NEW_PRODUCT_REQUESTS=true
ENABLE_DATAVERSE_SURVEY_LAYOUT=true
AZURE_TENANT_ID=<your Entra tenant ID>
```

Keep the existing Dataverse URL, public base URL and token/ingress secrets. Rotate both the exposed client secret and any ingress key that has appeared in screenshots. Enabling the two Dataverse feature flags before the custom tables and security privileges exist will make survey loading/submission fail, so publish tables and update the app-user role first.

## 9. Acceptance test

1. Qualify a disposable Lead to an Opportunity.
2. Set Contact, Region, Surveyor, survey dates and resolved Price List.
3. Trigger Flow 1. Confirm the email goes to the Surveyor, never the Contact.
4. Open in a private browser. Sign in as a different tenant/user and confirm access is denied; sign in as the assigned surveyor and confirm access.
5. Confirm customer, address, appointment and regional products are prefilled.
6. Submit catalogue products only. Confirm Opportunity Products and one draft Quote are created.
7. Repeat with a new Opportunity and add a non-catalogue request. Confirm Opportunity Products are saved, a pending Survey Product Request is created, and no Quote exists.
8. Map and approve the request. Confirm the approval flow adds the line once and creates one Quote.
9. Change the Region template section order and confirm a newly opened survey follows that layout.
10. Continue Quote -> Order and run the separate customer installation-confirmation flow.
