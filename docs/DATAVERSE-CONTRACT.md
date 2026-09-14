# Dataverse contract - existing tables only

This demonstration creates **no custom tables**. It stores the survey lifecycle on Opportunity and the installation-response lifecycle on Order Confirmation. Contact, Region, Account, Product, Price List, Price List Item and Appointment are read or used through their existing standard/custom records.

## Existing-table model

```mermaid
erDiagram
  CONTACT ||--o{ OPPORTUNITY : customer
  REGION ||--o{ OPPORTUNITY : assigned
  REGION }o--|| ACCOUNT : franchise
  ACCOUNT }o--|| PRICE_LIST : default
  PRICE_LIST ||--o{ PRICE_LIST_ITEM : contains
  PRODUCT ||--o{ PRICE_LIST_ITEM : priced
  OPPORTUNITY ||--o{ APPOINTMENT : survey
  OPPORTUNITY ||--o{ ORDER_CONFIRMATION : progresses_to
```

The Opportunity's standard `pricelevelid` is the authoritative Price List for its survey. Region and Franchise Account remain available for identity and contact information, but they do not supply a fallback product catalogue.

## Regional catalogue structure

Products are global master records and must not be duplicated for each franchise. Survey visibility belongs on Product; regional price and display differences belong on Price List Items:

1. Create or reuse the Franchise Account.
2. Create one Price List for the Region/currency.
3. Set the Opportunity's standard `pricelevelid` to that Price List.
4. Create or reuse the `ht_region` row and set its `ht_franchise` lookup to the Account.
5. Reuse the global Products and add one Price List Item per product required in that Region.
6. On each eligible Product set `ht_showincustomersurvey = Yes`.
7. On each Price List Item set `ht_surveydisplayorder`, `ht_surveycustomerdescription`, `ht_surveypricedisplaytext`, and `ht_surveypriceisindicative`.

The form includes the intersection of Products on the Opportunity Price List and Products whose `ht_showincustomersurvey` flag is Yes.

### Brighton pilot seeded on 10 September 2026

- Region: `Brighton` (`BRIGHTON`)
- Franchise Account: `Access4Lofts Brighton`
- Account number: `A4L-BRIGHTON`
- Price List: `Access4Lofts Brighton - GBP Survey`
- Currency: GBP
- Survey-enabled Price List Items: 21
- Global products created: 21, using stable `A4L-*` product numbers

The pilot GBP exchange rate was seeded as 1.3518 USD per GBP because this environment's base currency is USD. Finance must validate/update that rate before production invoicing.

## Existing columns reused

### Opportunity

- `parentcontactid` - customer
- `ht_region` - Region
- `pricelevelid` - Opportunity Price List
- `ht_surveyor` - Surveyor
- `ht_surveystart`, `ht_surveyfinish` - survey schedule
- `ht_surveyeventid` - created Appointment ID
- `ht_operationalstage` - existing sales stage
- `ht_propertypostcode`, `ht_streetname` - survey address

### Region and Account

- Region `ht_email` - regional sender address
- Region `ht_franchise` - Franchise Account
- Account `defaultpricelevelid` - regional/default product Price List

### Order Confirmation

- `ht_customercontact` - customer
- `ht_region` - Region
- `ht_installationstart`, `ht_installationfinish` - proposed schedule
- `ht_installationstatus` - existing operational installation status

## Columns added to existing Opportunity

These are columns, not tables. Before adding one, confirm that an equivalent column does not already exist.

| Display name | Schema name | Type | Purpose |
|---|---|---|---|
| Survey Automation Status | `ht_SurveyAutomationStatusKey` | Text 50 | `draft`, `sent`, `accepted`, `declined`, `reschedule_requested`, `expired`, `failed` |
| Survey Recipient Email | `ht_SurveyRecipientEmail` | Email | Recipient snapshot |
| Survey Response Expires At | `ht_SurveyExpiresAt` | Date/time | Signed-link expiry |
| Survey Token ID | `ht_SurveyTokenId` | Text 100 | Random identifier; never the signed token |
| Survey Allowed Product IDs | `ht_SurveyAllowedProductIds` | Multiline text | Immutable allowed IDs |
| Survey Products Snapshot | `ht_SurveyProductsSnapshotJson` | Multiline text | Names, quantities and Price List Item prices at send time |
| Survey Selected Product IDs | `ht_SurveySelectedProductIds` | Multiline text | Customer selection |
| Survey Selection Snapshot | `ht_SurveySelectionSnapshotJson` | Multiline text | Selected quantities, unit-price snapshot and product notes |
| Survey Product Review Status | `ht_SurveyProductReviewStatusKey` | Text 30 | `not_received`, `pending_review`, `reviewed`, `rejected` |
| Survey Response Reason | `ht_SurveyResponseReason` | Multiline text | Decline/reschedule/other message |
| Survey Feedback Score | `ht_SurveyFeedbackScore` | Whole number 1-5 | Optional |
| Survey Feedback Comments | `ht_SurveyFeedbackComments` | Multiline text | Optional |
| Survey Responded On | `ht_SurveyRespondedOn` | Date/time | Audit timestamp |
| Survey Automation Last Error | `ht_SurveyAutomationLastError` | Multiline text | Redacted technical message |

## Columns added to existing Order Confirmation

| Display name | Schema name | Type | Purpose |
|---|---|---|---|
| Installation Customer Response | `ht_InstallationResponseKey` | Text 50 | `draft`, `sent`, `accepted`, `declined`, `reschedule_requested`, `expired`, `failed` |
| Installation Recipient Email | `ht_InstallationRecipientEmail` | Email | Recipient snapshot |
| Installation Response Expires At | `ht_InstallationResponseExpiresAt` | Date/time | Signed-link expiry |
| Installation Response Token ID | `ht_InstallationResponseTokenId` | Text 100 | Random token identifier |
| Installation Response Reason | `ht_InstallationResponseReason` | Multiline text | Customer message |
| Installation Responded On | `ht_InstallationRespondedOn` | Date/time | Audit timestamp |

## Scheduling settings outside Dataverse

For this demonstration, time zone, duration and business hours are Azure application settings. The surveyor and surveyor mailbox come from the existing Opportunity `ht_surveyor` lookup and System User email. No Region column is added. `ht_regionid` remains the sole Region identifier.

## Demonstration behaviour

- The email/form requires the Opportunity Price List and reads only its survey-enabled Products and prices. There is no Region/Franchise Price List fallback.
- VAT is not displayed or calculated until Finance approves the authoritative rule.
- The response is saved on Opportunity. Selected products replace the existing Opportunity Products and the draft Quote Products, so unselected lines are excluded. Quote creation can be delegated to Power Automate with `CREATE_QUOTE_ON_SUBMIT=false`.
- The installation response is saved on Order Confirmation; no Task or additional record is created.
- Product and response snapshots prevent browser tampering and preserve what the customer saw.

## Security

- Application user: read Contact, Region, Account, Product, Price List and Price List Item; read/write Opportunity and Order Confirmation; create/read Appointment.
- Sales users: read response fields; update only fields appropriate to their role.
- Field security: token ID, snapshot JSON and last-error fields.
- Enable auditing on schedules, status, recipient, selected products, reasons and timestamps.
- Never store signed customer tokens or access tokens in Dataverse.
