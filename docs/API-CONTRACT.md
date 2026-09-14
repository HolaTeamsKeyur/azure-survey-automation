# HTTP API contract

Base path: `/api`. This is a design/development contract; URLs and credentials are placeholders until an approved Azure deployment exists.

## Ingress endpoints

### `POST /events/opportunity-ready`

Called by a Dataverse webhook, a small cloud flow, or the demonstration button when an Opportunity becomes survey-ready.

- Header `x-automation-key`: required. Static Web Apps exposes the managed function anonymously, then the function validates this shared ingress secret.
- JSON may be `{ "opportunityId": "GUID" }` or the standard Dataverse `RemoteExecutionContext` body. In the latter case `PrimaryEntityId` is used.
- Result: `202` after Opportunity survey metadata is prepared or `200` when its active token is reused. The JSON response includes `formUrl`, `recipientEmail`, `recipientName`, and `subject` so Power Automate can send the email when `SEND_SURVEY_EMAIL=false`.
- Invalid authentication returns `401`; malformed payload returns `400`; temporary processing failure returns `503` so Dataverse can make its single supported webhook retry. Responses include `x-correlation-id`.

### `POST /events/installation-ready`

Called when an Order Confirmation has approved installation start/end values.

- Result: `202` after the installation response session is prepared, or `200` when its active token is reused.
- When `SEND_INSTALLATION_EMAIL=false`, the response includes `orderId`, `orderName`, `formUrl`, `recipientEmail`, `recipientName`, `subject`, `scheduledStart`, and `scheduledEnd` for the Power Automate email action.

- Header `x-automation-key`: required.
- JSON may be `{ "orderId": "GUID" }` or the standard Dataverse `RemoteExecutionContext` body.
- Result: `202` after Order Confirmation response metadata is prepared or `200` when its active token is reused.
- It uses the same `401`/`400`/`503` failure classification and correlation header as the survey ingress.

## Outlook Actionable Message endpoint

### `POST /action/installation`

Used only by the installation-confirmation email. The endpoint validates the Outlook Entra token. JSON fields are `token`, `response`, and optional `reason`. The Order ID is intentionally not accepted from the browser; it is resolved from the signed token and matched to the Order Confirmation token ID.

## Hosted fallback endpoints

### `GET /survey/opportunity/{opportunity-guid}`

Permanent surveyor-facing entry point returned in `formUrl`. It requires Microsoft Entra sign-in, validates the configured tenant and assigned surveyor, and generates a fresh short-lived submission token behind the page. Refreshing an open survey renews its submission window; refreshing a completed survey shows the completed confirmation. A GUID is only a record locator and never grants access by itself.

### `GET|POST /survey/{signed-token}`

Internal signed submission endpoint used by the GUID page. Values are loaded from the related Opportunity and Contact. When an Opportunity value is missing, the API reads the originating Lead/Enquiry, uses it to prefill the survey, and persists supported missing values onto the Opportunity without overwriting existing Opportunity edits. The signed-in Entra user must be in the configured tenant and their email must match the assigned Surveyor's internal email. Product rows come only from the Opportunity Price List and are restricted to Products whose `ht_ShowInCustomerSurvey` flag is Yes. The immutable send-time snapshot prevents browser tampering. Opportunity Products are cleared; submitted catalogue selections are written only to the draft Quote Products. Non-catalogue entries create governed Survey Product Request rows and block Quote generation until approval; otherwise `CREATE_QUOTE_ON_SUBMIT=true` creates a draft Quote, or refreshes its existing draft Quote Products, with exactly the submitted products. JavaScript submits in-page as JSON so a processing error leaves the entered form intact; the non-JavaScript fallback redirects to the permanent GUID page after success.

### `GET|POST /installation/{signed-token}`

Displays and processes accept, decline or reschedule-request responses. A reschedule request records the reason on Order Confirmation; it never changes installation dates directly.

## Health

### `GET /health`

Liveness only. Readiness checks for Dataverse, Graph, storage and Key Vault must be added before production.

## Common controls

- HTTPS only, no-store responses and restrictive CSP on hosted pages.
- Internal submission tokens have issuer, audience, expiry, token ID, session ID and hashed recipient claims.
- Raw customer tokens are not stored in Dataverse or logs.
- Apply Front Door/WAF or API Management rate limiting before public release.
- Public error responses must not expose Dataverse payloads, access tokens or configuration.
- API responses now include correlation IDs and log failures with that ID; connect the Function logs to the approved monitoring destination before pilot.
