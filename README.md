# Access4Lofts survey automation

Production-oriented Dynamics 365 / Dataverse property survey workflow.

## Current workflow

1. A Lead is qualified to an Opportunity.
2. Sales sets Contact, Region, Surveyor, survey date/time and the Opportunity Price List.
3. Power Automate calls the Azure ingress endpoint and emails the returned link to the assigned Surveyor.
4. The Surveyor signs in with Microsoft Entra ID. The API requires the configured tenant and an email match to the assigned Dynamics System User.
5. The form preloads the Opportunity and Contact. Missing survey details are recovered from the originating Enquiry and copied onto the Opportunity without overwriting existing Opportunity values.
6. The form captures on-site details and displays an immutable snapshot of survey-enabled Products on the Opportunity Price List.
7. Catalogue selections are validated, any legacy Opportunity Product rows are removed, and the selected lines are written only to Quote Products.
8. A non-catalogue item becomes a Survey Product Request for office approval; a Quote is deliberately withheld until all requests are resolved.
9. With no pending request, Dynamics creates or refreshes one draft Quote with only the selected products and the existing Opportunity information.
10. The later installation-confirmation email is a separate customer-facing process.

## Security boundaries

- Surveyor: Azure Static Web Apps' built-in Entra sign-in; the API restricts access to the configured HolaTeams tenant. Shared-mailbox links can be completed by an authenticated tenant employee.
- Backend: Dataverse Application User/service principal; no Graph permission when Power Automate sends mail.
- Power Automate: Office 365 Outlook connector sends survey and installation messages.
- Survey link: stable Opportunity GUID route protected by Entra tenant and assigned-email checks; a short-lived signed token is generated internally for submission and is not exposed in the emailed URL.
- Browser resilience: in-page submission keeps failures on the form, and same-tab draft recovery restores unsaved entries after an accidental refresh.
- Automation ingress: separate rotating header secret.
- Submitted product IDs: restricted to the immutable session snapshot.

`Calendars.ReadBasic.All` and `Mail.Send` are not required for the current backend. Calendar access is reserved for a future, explicitly approved free/busy feature.

## Build and test

```powershell
npm.cmd ci
npm.cmd run check
```

Local demonstration (Entra enforcement disabled only in local settings):

```powershell
npm.cmd run demo:local
```

Never commit `local.settings.json`, deployment tokens, client secrets, ingress keys or token-signing secrets.

## Authoritative build guide

Use [docs/PRODUCTION-SURVEY-RUNBOOK.md](docs/PRODUCTION-SURVEY-RUNBOOK.md) for:

- Entra registrations and permissions
- Dataverse tables, fields, forms and security role
- regional Price Lists and Products
- Power Automate send/approval flows
- Azure settings
- full acceptance testing

Supporting contracts:

- [docs/DATAVERSE-FIELDS.csv](docs/DATAVERSE-FIELDS.csv)
- [docs/API-CONTRACT.md](docs/API-CONTRACT.md)
- [docs/POWER-AUTOMATE-SURVEY-FLOWS.md](docs/POWER-AUTOMATE-SURVEY-FLOWS.md)
- [docs/ACTIONABLE-MESSAGES.md](docs/ACTIONABLE-MESSAGES.md)

Older documents labelled demonstration or legacy are historical and are not the production source of truth.
