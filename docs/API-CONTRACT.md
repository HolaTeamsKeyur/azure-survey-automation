# HTTP API contract

Base path: `/api`. This is a design/development contract; URLs and credentials are placeholders until an approved Azure deployment exists.

## Ingress endpoints

### `POST /events/opportunity-ready`

Called by a Dataverse webhook, a small cloud flow, or the demonstration button when an Opportunity becomes survey-ready.

- Header `x-automation-key`: required. Static Web Apps exposes the managed function anonymously, then the function validates this shared ingress secret.
- JSON may be `{ "opportunityId": "GUID" }` or the standard Dataverse `RemoteExecutionContext` body. In the latter case `PrimaryEntityId` is used.
- Result: `202` after Opportunity survey metadata is prepared or `200` when its active token is reused.
- Invalid authentication returns `401`; malformed payload returns `400`; temporary processing failure returns `503` so Dataverse can make its single supported webhook retry. Responses include `x-correlation-id`.

### `POST /events/installation-ready`

Called when an Order Confirmation has approved installation start/end values.

- Header `x-automation-key`: required.
- JSON may be `{ "orderId": "GUID" }` or the standard Dataverse `RemoteExecutionContext` body.
- Result: `202` after Order Confirmation response metadata is prepared or `200` when its active token is reused.
- It uses the same `401`/`400`/`503` failure classification and correlation header as the survey ingress.

## Outlook Actionable Message endpoints

### `POST /action/survey`

Receives `Action.Http` from Outlook.

- Entra bearer token from the Outlook Actions service: required.
- The service validates signature, issuer, API audience, calling application and permitted tenant.
- JSON: `token`, `response`, optional `selectedProducts`, and optional `reason`.
- `response`: `accepted`, `declined`, or `reschedule_requested`.
- The Outlook actor email must hash to the recipient snapshot in the signed session token.

### `POST /action/installation`

Uses the same Entra validation. JSON fields are `token`, `response`, and optional `reason`. The Order ID is intentionally not accepted from the browser; it is resolved from the signed token and matched to the Order Confirmation token ID.

## Hosted fallback endpoints

### `GET|POST /survey/{signed-token}`

Displays and processes the full product/feedback form. Product choices come from the immutable snapshot stored on Opportunity, not from browser input or the current live Price List.

### `GET|POST /installation/{signed-token}`

Displays and processes accept, decline or reschedule-request responses. A reschedule request records the reason on Order Confirmation; it never changes installation dates directly.

## Health

### `GET /health`

Liveness only. Readiness checks for Dataverse, Graph, storage and Key Vault must be added before production.

## Common controls

- HTTPS only, no-store responses and restrictive CSP on hosted pages.
- Tokens have issuer, audience, expiry, token ID, session ID and hashed recipient claims.
- Raw customer tokens are not stored in Dataverse or logs.
- Apply Front Door/WAF or API Management rate limiting before public release.
- Public error responses must not expose Dataverse payloads, access tokens or configuration.
- API responses now include correlation IDs and log failures with that ID; connect the Function logs to the approved monitoring destination before pilot.
