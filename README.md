# Access4Lofts survey automation

Production-oriented Dynamics 365 / Dataverse property survey workflow.

## Current workflow

1. A Lead is qualified to an Opportunity.
2. Sales sets Contact, Region, Surveyor, survey date/time and the resolved regional Price List.
3. Power Automate calls the Azure ingress endpoint and emails the returned link to the assigned Surveyor.
4. The Surveyor signs in with Microsoft Entra ID. The API requires the configured tenant and an email match to the assigned Dynamics System User.
5. The form preloads the Opportunity and Contact, captures on-site details and displays the immutable regional Price List snapshot.
6. Catalogue selections are validated and upserted as Opportunity Products.
7. A non-catalogue item becomes a Survey Product Request for office approval; a Quote is deliberately withheld until all requests are resolved.
8. With no pending request, Dynamics creates one draft Quote from the Opportunity.
9. The later installation-confirmation email is a separate customer-facing process.

## Security boundaries

- Surveyor: Azure Static Web Apps' built-in Entra sign-in; the API then restricts access to the configured HolaTeams tenant and assigned surveyor email.
- Backend: Dataverse Application User/service principal; no Graph permission when Power Automate sends mail.
- Power Automate: Office 365 Outlook connector sends survey and installation messages.
- Survey link: signed, expiring token plus tenant and assigned-email checks.
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
