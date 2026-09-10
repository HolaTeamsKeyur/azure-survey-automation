# Demonstration implementation backlog

| ID | Story | Status | Acceptance |
|---|---|---|---|
| DEMO-001 | Confirm one Opportunity and one Order scenario | Pending input | Test records and expected outcomes agreed |
| DEMO-002 | Add missing response columns to existing tables | Designed | Opportunity and Order columns only; zero new tables |
| DEMO-003 | Add Opportunity survey section | Pending deployment | Schedule, send status, customer response and feedback visible |
| DEMO-004 | Add Order installation-response section | Pending deployment | Installation proposal and customer response visible |
| DEMO-005 | Configure existing Price Lists by Region/Franchise | Pending data | Form shows correct regional products and prices |
| DEMO-006 | Create least-privilege application user | Pending tenant work | Access restricted to required existing records/columns |
| DEMO-007 | Create Azure Static Web Apps Free host | Pending Azure values | Public HTTPS form and managed API respond |
| DEMO-008 | Automatic survey availability and Appointment | Implemented locally; integration pending | Uses surveyor free/busy and existing Opportunity schedule fields |
| DEMO-009 | Survey public form | Implemented locally; integration pending | Accept/decline/reschedule, validated regional products and feedback save on Opportunity |
| DEMO-010 | Installation public form | Implemented locally; integration pending | Validated accept/decline/reschedule and reason save on Order |
| DEMO-011 | Transactional email | Implemented locally; mailbox approval pending | Approved sender sends public signed link |
| DEMO-012 | Optional Outlook Actionable Message | External pending | Test provider renders and callbacks validate Entra token |
| DEMO-013 | Security and negative tests | Local controls tested; edge controls pending | Input/state validation, error redaction and correlation IDs implemented; forwarding, live expiry, concurrency and edge rate limits require deployed tests |
| DEMO-014 | Demonstration script and evidence | Pending deployment | Repeatable Opportunity and Order walkthrough |
| DEMO-015 | Dynamic regional survey Word document | Technical baseline implemented | Generated template repeats regional product rows; approved brand master and Azure Blob upload pending |
| FUTURE-001 | Quote/product-line conversion | Deferred | Explicitly outside current demo |
| FUTURE-002 | Finance-approved VAT automation | Deferred | No VAT inferred in demo |

## Start sequence

1. Export a fresh solution backup.
2. Add only the approved fields from `DATAVERSE-CONTRACT.md`.
3. Add the Opportunity and Order form sections.
4. Create the Static Web App Free resource and application identity.
5. Configure Dataverse/Graph access and application settings.
6. Deploy code with customer send restricted to test mailboxes.
7. Demonstrate hosted survey and installation forms.
8. Add the Outlook card only if test-provider registration is ready.
