# Fit/gap analysis

## Executive answer

The demonstration can be delivered without Customer Insights/Journeys and without new Dataverse tables. Azure Static Web Apps Free, its managed HTTP API, Dataverse, Microsoft Graph and a signed public form cover it. Actionable Messages alone are not sufficient for all customers, so the hosted form remains the guaranteed path.

| Requirement | Microsoft fit | Gap / custom work | Recommendation |
|---|---|---|---|
| Region-based products | Standard Product, Price List and Price List Item | Use Opportunity Price List, falling back through Region Franchise Account to Account Default Price List | No new configuration table |
| Region VAT | Standard line tax columns exist | VAT policy is not safely derivable from Region; UK reduced-rate rules may depend on work/customer | Finance-approved rule table or accounting service; do not guess |
| Automatic survey slot | Graph `getSchedule` + Dataverse Appointment | Slot algorithm, working hours, holidays, travel time, capacity | Phase 1 earliest slot; Phase 2 capacity/travel optimisation |
| Survey Word document | DOCX template + Azure rendering | Conditional sections/repeating products and brand variants | Use versioned DOCX template with loop tags; retain approved PDF option |
| Email card | Outlook Actionable Messages | Provider registration, Entra API setup, tenant consent, client limitations | Progressive enhancement only |
| Full customer form | Azure Static Web Apps Free + managed API | Public security, accessibility, consent, retention; Free has no SLA | Signed short-lived link; add email OTP before production |
| Customer product selection | Adaptive ChoiceSet / hosted checkboxes | Card choices are static at send time and should stay small | Show top 20 in card, all in hosted form |
| Automatic Quote | Native `GenerateQuoteFromOpportunity` | Out of current demo scope | Keep disabled until survey UAT |
| Installation accept/decline | Signed form/card using existing Order Confirmation | Additional response columns and wording | Save directly on Order Confirmation |
| Feedback | Opportunity response columns | Reporting and retention | Store directly on Opportunity |
| SharePoint SPFx public form | SPFx is suited to authenticated SharePoint users | Not a general anonymous public application | Do not select for customer-facing demo |
| Calendar email reply parsing | Possible with Graph subscriptions | Free-text replies are ambiguous and brittle | Do not use reply parsing as the primary input |
| Customer Insights/Journeys | Would provide journeys/forms | Additional licence/module and heavier operating model | Not required for this scope |

## Actionable Message limitations that affect design

- Outlook Actionable Messages do not work in every Outlook/mail client.
- Provider registration is required before sending cards broadly.
- Current integrations must use Microsoft Entra ID token authentication; legacy authentication is no longer acceptable.
- `Action.Submit` is not supported by the classic Outlook Actionable Message model. The Azure-web-endpoint design uses Adaptive Card 1.0 with `Action.Http`.
- Adaptive Card 1.4+ `Action.Execute` uses the Universal Actions/Bot path, which is a different architecture and is not selected for phase 1.
- Forwarded email protection requires matching the Entra action-token user to the original recipient.
- External customer tenants may require admin consent for a globally registered provider.
- Email security gateways can modify markup and prevent cards from rendering.

## Gaps requiring business decisions

| Decision | Owner | Needed before |
|---|---|---|
| Which event makes an Opportunity “survey ready”? | Sales owner | Trigger deployment |
| May the system auto-book without staff confirmation? | Operations | Scheduling UAT |
| Region working hours, holidays, duration and default surveyor | Regional operations | Seed data |
| Product eligibility, default quantities and price source | Product/Finance | Product-rule UAT |
| VAT calculation authority and exception handling | Finance/Tax adviser | Any customer-visible price |
| Does accept create the Quote immediately or a review task first? | Sales owner | Quote automation |
| Customer wording, privacy notice and retention | Legal/DPO | External pilot |
| Provider scope: test, organisation or global | IT/M365 owner | Actionable Message registration |
| Sender mailbox and Graph application-permission approval | M365 admin | Email integration |
| OTP requirement for hosted form | Security/DPO | Production go-live |

## Recommended phases

1. Internal technical spike: existing Opportunity/Order fields, Price Lists, hosted form and DOCX, no customer send.
2. Controlled demo: one Opportunity, one Order Confirmation and test mailboxes.
3. Customer pilot: hosted form first; Actionable Message provider in test/org scope.
4. Automatic Quote: consider only after product and VAT reconciliation passes.
5. Installation response: use the same signed-link pattern on Order Confirmation.
6. Scale/hardening: Service Bus, OTP, WAF/APIM, dead-letter replay, dashboards and retention jobs.
