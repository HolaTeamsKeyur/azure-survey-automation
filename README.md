# HolaTeams survey and installation-response demonstration

Public survey/confirmation form and email automation using existing Dataverse tables. It does not require Customer Insights/Journeys, Power Pages or any new Dataverse table.

## Demonstration scope

1. Opportunity triggers automatic survey scheduling.
2. The service reads Contact, Region, Surveyor and the applicable standard Price List.
3. It saves the schedule, secure-token metadata and product snapshot on Opportunity.
4. A Dataverse webhook can start the process without a premium Power Automate HTTP action. The service creates a standard Dataverse Appointment and sends the customer an email containing a signed public form link and optional Outlook Actionable Message.
5. The customer accepts, declines or requests another time, selects products and submits feedback.
6. The response is saved directly on Opportunity.
7. Order Confirmation uses the same pattern for installation accept/decline/reschedule; its response is saved directly on the Order.

Automatic Quote creation is intentionally disabled for this demonstration.

## Hosting recommendation

Use Azure Static Web Apps Free with managed HTTP API functions for the demonstration. It supplies public HTTPS hosting without an extra Dynamics module. Free tier has no SLA and is not a production commitment.

SPFx is not selected because a SharePoint page/web part is an authenticated SharePoint experience; SharePoint Anyone links do not turn an SPFx page into a general anonymous public application.

## Current status

- TypeScript form/API/email/scheduling code: implemented locally and build-tested.
- Existing-table Dataverse contract: prepared.
- Architecture, security, test and deployment documentation: prepared.
- Local verification: run `npm.cmd run check`; 24 tests currently cover configuration dependencies, scheduling, transitions, input validation, safe error handling, card content, dynamic Word rendering and Dataverse webhook payload parsing.
- Azure/Dataverse deployment: not performed.
- Technical Word baseline: generated and render-tested; final branding/copy, pricing/VAT and security approval remain pending.

## Local commands

```powershell
Copy-Item local.settings.example.json local.settings.json
npm.cmd install
npm.cmd run check
npm.cmd run template:generate
```

Never place production secrets in source control or commit `local.settings.json`.

`templates/survey-template.baseline.docx` is a generated technical baseline with a shared header/footer and one repeating regional-product row. Replace its plain branding with the approved design before enabling Word attachments, but preserve the merge tags.

## Documentation

- `docs/ARCHITECTURE.md` - current no-new-table architecture and diagrams
- `docs/DATAVERSE-CONTRACT.md` - existing tables and required columns
- `docs/DATAVERSE-MANUAL-BUILD.md` - exact separate-solution steps and field list
- `docs/DATAVERSE-MANUAL-EXECUTION-GUIDE.md` - click-by-click Dataverse build sheet for manual execution
- `docs/STATIC-WEB-APP-SETUP.md` - Free hosting and deployment configuration
- `docs/API-CONTRACT.md` - HTTP endpoints
- `docs/ACTIONABLE-MESSAGES.md` - Outlook registration/security
- `docs/FIT-GAP.md` - platform fit and remaining decisions
- `docs/DEPLOYMENT-RUNBOOK.md` - approval-gated deployment
- `docs/TEST-PLAN.md` - functional/security tests
- `docs/IMPLEMENTATION-BACKLOG.md` - delivery tasks
- `docs/MORNING-START-CHECKLIST.md` - exact starting order
- `docs/END-TO-END-IMPLEMENTATION-RUNBOOK.md` - complete Dataverse, regional Price List, Azure form, Word, buttons, webhook, Outlook card, test and release execution guide
- `docs/ZOHO-WORD-TEMPLATE-ASSESSMENT.md` - evidence from all 96 Blank Enquiry DOCX exports and the safe canonical-template decision

The isolated unmanaged Dataverse solution shell is at `../power-platform/HolaTeamsSurveyAutomationDemo`. It contains no table assets until the approved Opportunity/Order columns and form sections are built in HolaTeams and exported into it.

## Safeguards

- No new Dataverse tables.
- No automatic Quote in the demo.
- No VAT inference.
- No automatic installation-date replacement.
- Browser-submitted products are checked against the immutable Opportunity snapshot.
- The hosted form remains available when an Outlook card cannot render.
