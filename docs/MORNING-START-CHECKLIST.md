# Start checklist - existing Opportunity and Order only

No Azure or Dataverse deployment has been performed.

## Provide or confirm

1. Development environment and Azure subscription/resource group.
2. Static Web App name and deployment repository/branch.
3. One test Opportunity and one test Order Confirmation.
4. Approved sender mailbox and surveyor mailbox.
5. Correct Opportunity or Franchise Account Default Price List.
6. Final email/form wording and logo.
7. Whether to include the Outlook card in the first demo or use the public link only.

## Build order

1. Export a new unmanaged `HolaTeamsOperations` backup.
2. Add only missing Opportunity and Order Confirmation columns from `DATAVERSE-CONTRACT.md`.
3. Add small Survey Response and Installation Response sections to the existing forms.
4. Create Azure Static Web Apps Free.
5. Register the application identity and least-privilege Dataverse/Graph permissions.
6. Configure app settings and secrets.
7. Deploy with customer email restricted to internal test addresses.
8. Run manual API smoke tests for Opportunity and Order Confirmation.
9. Register the two asynchronous Dataverse webhooks with `x-automation-key` authentication.
10. Add only those Service Endpoint/step components to the separate demo solution.
11. Demonstrate survey form creation, sending and Opportunity update.
12. Demonstrate installation confirmation and Order update.
13. Capture evidence and remove test-recipient restriction only after approval.

## Local verification

```powershell
Set-Location "C:\Work\HolaTeams\Access4Lofts\Zoho CRM\Node Application\azure-survey-automation"
npm.cmd install
npm.cmd run check
```

## Explicitly excluded

- New Dataverse tables
- Customer Insights/Journeys
- Power Pages
- Anonymous SPFx page
- Quote creation
- Task creation
- VAT calculation
- Production SLA
