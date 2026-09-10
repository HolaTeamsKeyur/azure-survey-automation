# Approval-gated demonstration runbook

Nothing in this package is deployed. The current design creates no Dataverse tables and uses only existing business records plus approved columns.

## Gate 0 - decisions

- Confirm development/demo environment.
- Select one test Opportunity and one test Order Confirmation.
- Confirm approved sender and surveyor mailbox.
- Confirm customer-facing wording and signed-link security acceptance for the demo.
- Confirm the Opportunity/Franchise Account Price List used for products.
- Keep VAT and automatic Quote creation disabled.

## Gate 1 - small Dataverse solution

1. Export an unmanaged `HolaTeamsOperations` backup.
2. Reconfirm existing logical names from the fresh export.
3. Add only missing columns listed in `DATAVERSE-CONTRACT.md` to Opportunity and Order Confirmation.
4. Add response sections to the existing Opportunity and Order forms.
5. Add the columns to appropriate views only if useful for the demo.
6. Apply field security to token ID, product snapshot and error fields.
7. Enable auditing for schedule, recipient, response, products and timestamps.
8. Do not create Survey Session, Installation Session, Region Product Rule or another Region identifier.

## Gate 2 - public form hosting

Recommended demo host: Azure Static Web Apps Free with managed HTTP API functions.

1. Create a Free Static Web App in the approved subscription.
2. Configure the repository/app and API locations.
3. Configure application settings for Dataverse, Graph, sender, public URL, token secret and Actionable Messages values.
4. Use an Entra application/service principal for Dataverse and Graph access.
5. Keep all secrets in application settings/Key Vault; never commit them.
6. Configure HTTPS, no-store headers and CSP.
7. Free tier has no SLA; do not call it the production architecture.

The older standalone Functions Bicep file remains a reference only. Update it to Static Web Apps or deploy manually for the demo after approval.

## Gate 3 - least privilege

Dataverse application user:

- Read Contact, Region, Account, Product, Price List and Price List Item.
- Read/write only approved Opportunity and Order Confirmation fields.
- Create/read Appointment if automatic scheduling is included.

Microsoft Graph:

- `Calendars.ReadBasic` for `calendar/getSchedule`.
- `Mail.Send` for the approved sender mailbox.
- Restrict application access to the approved mailboxes using Exchange application RBAC/policy.

## Gate 4 - triggers

Create two small flows only:

1. Opportunity demo command/trigger calls `POST /api/events/opportunity-ready` with Opportunity ID.
2. Order Confirmation demo command/trigger calls `POST /api/events/installation-ready` with Order ID.

Use trigger-column filtering or a manual command so repeated edits do not send duplicate messages. Keep all response logic in the API.

## Gate 5 - demonstration sequence

1. Run `/api/health`.
2. Verify application-user access to the test Opportunity and Order.
3. Verify Price List Items appear on the survey form.
4. Send to an internal test mailbox first.
5. Open the public form in a private browser session.
6. Test accept, decline, reschedule, product tampering and expired token.
7. Confirm only Opportunity fields changed for survey responses.
8. Confirm only Order Confirmation fields changed for installation responses.
9. Test optional Outlook card only after test-provider configuration.

## Rollback

- Disable the two trigger flows/commands.
- Remove or rotate public token secrets.
- Disable the Static Web App.
- Preserve audited Opportunity/Order responses.
- Remove unused columns only after exporting their data and confirming no dependencies.

## Still required

- Azure subscription/resource group and Static Web App name
- repository deployment connection
- Dataverse application registration/user
- approved sender and surveyor mailboxes
- test Opportunity and Order IDs
- final form/email wording and logo
- Price List confirmation
- Actionable Messages test provider details, if the card is included
