# Urgent administrator identity request

## Copy/paste request

**Subject:** Urgent: HolaTeams Survey Automation development application identity

Please create the following development-only server identity for the HolaTeams survey demonstration. I do not need permanent App Registration access; I need the resulting IDs and secret delivered securely.

1. Create a **single-tenant** Microsoft Entra app registration named `HolaTeams Survey Automation Dev`.
2. No redirect URI is required.
3. Add Microsoft Graph **Application** permissions:
   - `Mail.Send`
   - `Calendars.Read`
4. Grant tenant administrator consent.
5. Create a client secret using the shortest expiry allowed by policy.
6. Send these outputs:
   - Directory/tenant ID — non-secret
   - Application/client ID — non-secret
   - Client secret **value** and expiry — through the approved password/secret-sharing channel, not email/chat
7. Ask the Power Platform administrator to create an application user for this app in **HolaTeams development** and assign the approved least-privilege survey automation security role.
8. Ask the Exchange administrator to restrict the app's Graph access to only the approved sender mailbox and surveyor mailboxes using Exchange application RBAC/access policy.

Required development Dataverse environment:

```text
https://holateams-operations.crm.dynamics.com/
```

The application must not be added to Access4Lofts production during this demonstration.

## Why these permissions are needed

- `Mail.Send`: send the customer the signed browser link and optional Outlook Actionable Message.
- `Calendars.Read`: call Microsoft Graph `getSchedule` for surveyor free/busy information. The code does not read message bodies or modify calendar events through Graph.
- Dataverse application user: read the approved Opportunity/customer/Region/Price List data, create a survey Appointment, and update the approved Opportunity/Order response columns.

The Dataverse security role, Exchange restriction and development-only scope limit the effective access. Do not grant broad Dataverse System Administrator rights to the application user.

## Values to return

| Value | Delivery |
|---|---|
| Tenant ID | Normal internal channel |
| Client ID | Normal internal channel |
| Client secret value | Approved secure secret channel only |
| Client secret expiry | Normal internal channel |
| Approved sender mailbox | Normal internal channel |
| Confirmation of Graph admin consent | Normal internal channel |
| Confirmation of Dataverse application user/role | Normal internal channel |
| Confirmation of Exchange mailbox restriction | Normal internal channel |

## Work that can continue before the identity arrives

1. Create Azure Static Web Apps Free using the GitHub repository.
2. Allow the GitHub workflow to deploy the static site and managed API.
3. Verify `/` and `/api/health`.
4. Add non-secret environment variables and keep these feature flags false:

```text
ENABLE_ACTIONABLE_MESSAGES=false
ENABLE_WORD_DOCUMENT=false
```

5. Finish regional Price List data and test records.

Do not register/enable the Dataverse send webhooks until the identity, Dataverse application user and Graph consent are complete. The actual survey/email endpoints cannot operate without server-to-server authentication.
