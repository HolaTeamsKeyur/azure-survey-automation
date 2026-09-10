# Outlook Actionable Messages implementation

## Selected model

Phase 1 uses Adaptive Card 1.0 with Outlook `Action.Http`, posting to an anonymous Azure Function endpoint that validates the Microsoft Entra action token and the signed session token. The full Azure form link is always present.

Do not use `Action.Submit`; it is not supported by the classic Outlook Actionable Message model. Do not silently switch to Adaptive Card 1.4 `Action.Execute`: that requires the Universal Actions/Azure Bot design and separate testing.

## Registration checklist

1. Create a Microsoft Entra app registration for the Actionable Message target API.
2. Expose the exact Application ID URI generated/required by the Actionable Messages registration.
3. Add an API scope (for example `ActionableMessage.Submit`).
4. Pre-authorise Microsoft’s Actions application ID `48af08dc-f6d2-435f-b2a7-069abd99c086` for that scope.
5. Register the provider in the Actionable Messages developer dashboard.
6. Start with Test scope, then Organisation scope. Use Global only if external tenant behaviour and admin consent are accepted.
7. Configure the returned Originator ID as `ACTIONABLE_ORIGINATOR_ID`.
8. Configure the target URL exactly as the Azure Function public HTTPS URL.
9. Send from a stable mailbox/domain with aligned DKIM/SPF and approved content.
10. Test Outlook desktop, web, iOS and Android plus non-Outlook fallback.

As of June 2026, legacy Actionable Message token authentication is no longer supported. The endpoint must validate the Entra token: signature, issuer, audience, expiry, tenant and authorised caller application.

## Callback security

The implementation performs both checks:

1. Validate the Entra bearer token sent by Outlook. Verify the tenant policy, API audience and Actions caller app ID.
2. Validate the short-lived signed session token embedded in the card. Match its recipient hash and token ID to the Dataverse session.

It then compares the Entra user email/UPN to the original recipient hash. This blocks a forwarded card from being actioned by another Outlook user.

For hosted-form submissions there is no Outlook Entra token. Before production, add email OTP for quote acceptance or have Legal/Security explicitly accept signed-link authentication.

## Response headers

The API returns `CARD-ACTION-STATUS` so Outlook can show a human-readable result. Failures instruct the user to open the secure form link. Do not return stack traces, Dataverse errors or identifiers to customers.

## Provider and client risks

- A card may not render because the client is unsupported, the provider is not approved for the recipient, a tenant has not consented, or a security gateway rewrote the message.
- Shared and group mailbox scenarios have product limitations.
- Actionable Messages are intended for simple transactional actions. The full product catalogue and complex survey remain on the hosted form.
- Messages older than the supported action window may stop accepting actions; the hosted token has its own shorter expiry.
- Global provider approval has sender-quality and operational requirements and should not be assumed.

## Test modes

| Mode | Recipients | Purpose |
|---|---|---|
| Designer | Developer only | Card layout and action payload |
| Test provider | Named test users | Token validation and callback |
| Organisation provider | Access4Lofts tenant | Internal operational pilot |
| Global provider | External Microsoft 365 tenants | Customer pilot after approval/consent |
| Fallback form | Any modern browser | Guaranteed customer journey |
