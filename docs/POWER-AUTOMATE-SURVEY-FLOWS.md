# Power Automate email flows

Use one authoritative writer for email and one authoritative writer for Quote creation. Do not enable the Azure and Power Automate writer for the same operation.

## Pilot settings

- Set Azure `SEND_SURVEY_EMAIL=false` when Flow 1 sends the email.
- Set Azure `SEND_INSTALLATION_EMAIL=false` when Flow 3 sends the installation email.
- Set Azure `ENABLE_AUTO_SCHEDULING=false` to avoid Graph/calendar permissions for the link-only pilot. Existing Opportunity survey dates are used when present.
- Set Azure `ENABLE_ACTIONABLE_MESSAGES=false`; Flow 3 uses the Office 365 Outlook connector's native actionable email instead of Azure/Graph card delivery.
- Keep Azure `CREATE_QUOTE_ON_SUBMIT=true` for the fastest pilot; Flow 2 is then unnecessary.
- If Flow 2 must create the Quote, set Azure `CREATE_QUOTE_ON_SUBMIT=false` before enabling Flow 2.
- Regional pilot Price List: `Access4Lofts Brighton - GBP Survey`.

## Flow 1 - Opportunity - Send Assigned Surveyor Link

1. Create an **Automated cloud flow** named `A4L - Opportunity - Send Assigned Surveyor Link`.
2. Trigger: Microsoft Dataverse **When a row is added, modified or deleted**.
3. Configure the trigger:
   - Change type: `Modified`
   - Table name: `Opportunities`
   - Scope: `Organization`
   - Select columns: `ht_surveysendrequestedon`
   - Filter rows: `ht_surveysendrequestedon ne null`
4. Add **HTTP**:
   - Method: `POST`
   - URI: `https://<AZURE-HOST>/api/events/opportunity-ready`
   - Header `Content-Type`: `application/json`
   - Header `x-automation-key`: use a secure environment variable/secret, never literal production text.
   - Body:

```json
{
  "opportunityId": "@{triggerOutputs()?['body/opportunityid']}"
}
```

5. Add **Parse JSON** using the HTTP body and this schema:

```json
{
  "type": "object",
  "properties": {
    "sessionId": { "type": "string" },
    "reused": { "type": "boolean" },
    "formUrl": { "type": "string" },
    "recipientEmail": { "type": "string" },
    "recipientName": { "type": "string" },
    "subject": { "type": "string" },
    "correlationId": { "type": "string" }
  },
  "required": ["sessionId", "reused", "formUrl", "recipientEmail", "recipientName", "subject"]
}
```

6. Add Office 365 Outlook **Send an email (V2)**:
   - To: `recipientEmail` from Parse JSON
   - Subject: `subject` from Parse JSON
   - Body (HTML):

```html
<p>Hello @{body('Parse_JSON')?['recipientName']},</p>
<p>You have been assigned an Access4Lofts property survey.</p>
<p><a href="@{body('Parse_JSON')?['formUrl']}">Open property survey</a></p>
<p>Sign in with the same Microsoft 365 account to which this message was sent. The customer must not receive or complete this form.</p>
```

7. In trigger settings enable concurrency control and set degree of parallelism to `1`.
8. Save, turn on, and test only with an internal email address first.

The URL returned by Azure contains a signed token. Do not construct a public URL containing only an Opportunity GUID.

## Flow 2 - Survey Submitted - Create Draft Quote

Create this only when Azure `CREATE_QUOTE_ON_SUBMIT=false`.

1. Create an **Automated cloud flow** named `A4L - Survey Submitted - Create Draft Quote`.
2. Trigger: Dataverse **When a row is added, modified or deleted**.
3. Configure:
   - Change type: `Modified`
   - Table name: `Opportunities`
   - Scope: `Organization`
   - Select columns: `ht_surveyrespondedon,ht_surveyautomationstatuskey`
   - Filter rows: `ht_surveyautomationstatuskey eq 'accepted' and ht_surveyrespondedon ne null`
4. Add Dataverse **List rows** for `Quotes`:
   - Filter rows: `_opportunityid_value eq @{triggerOutputs()?['body/opportunityid']}`
   - Row count: `1`
5. Add a Condition with this expression:

```text
equals(length(outputs('List_rows_-_Quotes')?['body/value']), 0)
```

6. In the Yes branch add Dataverse **Perform an unbound action** and select `GenerateQuoteFromOpportunity`.
7. Set:
   - OpportunityId: the trigger `opportunityid`
   - ColumnSet AllColumns: `false`
   - ColumnSet Columns: `quoteid`, `name`, `opportunityid`, `customerid`, `pricelevelid`
8. Leave the No branch empty. This duplicate check is mandatory.
9. Set concurrency to `1`, save, and test with one disposable Opportunity.

The Azure submit handler applies the resolved regional Price List and its currency to the Opportunity before adding selected Opportunity Products. The standard `GenerateQuoteFromOpportunity` action then copies only those Opportunity Products into Quote Products and calculates native Quote totals.

## Flow 3 - Order - Send Installation Confirmation

This flow avoids the ungranted Graph `Mail.Send` permission. The Office 365 Outlook connection sends the actionable email under the signed-in flow owner's delegated access.

1. Create an **Automated cloud flow** named `A4L - Order - Send Installation Confirmation`.
2. Trigger: Microsoft Dataverse **When a row is added, modified or deleted**.
3. Configure the trigger:
   - Change type: `Modified`
   - Table name: `Orders`
   - Scope: `Organization`
   - Select columns: `ht_installationconfirmationrequestedon`
   - Filter rows: `ht_installationconfirmationrequestedon ne null`
4. Add **HTTP**:
   - Method: `POST`
   - URI: `https://<AZURE-HOST>/api/events/installation-ready`
   - Header `Content-Type`: `application/json`
   - Header `x-automation-key`: the same secure value as Azure `AUTOMATION_INGRESS_KEY`
   - Body:

```json
{
  "orderId": "@{triggerOutputs()?['body/salesorderid']}"
}
```

5. Add **Parse JSON** using the HTTP body and this schema:

```json
{
  "type": "object",
  "properties": {
    "sessionId": { "type": "string" },
    "reused": { "type": "boolean" },
    "orderId": { "type": "string" },
    "orderName": { "type": "string" },
    "formUrl": { "type": "string" },
    "recipientEmail": { "type": "string" },
    "recipientName": { "type": "string" },
    "subject": { "type": "string" },
    "scheduledStart": { "type": "string" },
    "scheduledEnd": { "type": "string" }
  },
  "required": ["sessionId", "orderId", "formUrl", "recipientEmail", "recipientName", "subject", "scheduledStart", "scheduledEnd"]
}
```

6. Add Office 365 Outlook **Send email with options** (not `Send an email (V2)`):
   - To: `recipientEmail`
   - Subject: `subject`
   - User Options: `Accept installation,Request another time,Decline`
   - Header Text: `Access4Lofts installation confirmation`
   - Selection Text: `Please choose one option`
   - Body:

```html
Hello @{body('Parse_JSON')?['recipientName']},<br><br>
Please confirm your installation for @{body('Parse_JSON')?['scheduledStart']} to @{body('Parse_JSON')?['scheduledEnd']}.<br><br>
If the buttons are not available, or you need to include a reason, use this secure link:<br>
<a href="@{body('Parse_JSON')?['formUrl']}">Open installation confirmation</a>
```

   - Use only HTML message: `No`
   - Hide HTML message: `No`
   - Show HTML confirmation dialog: `Yes`
7. Add Dataverse **Get a row by ID**:
   - Table: `Orders`
   - Row ID: `orderId` from Parse JSON
8. Add a Condition so a late email click cannot overwrite a response already received through the browser form:

```text
or(
  equals(outputs('Get_a_row_by_ID')?['body/ht_installationresponsekey'], 'draft'),
  equals(outputs('Get_a_row_by_ID')?['body/ht_installationresponsekey'], 'sent')
)
```

9. In the **Yes** branch add a Switch on the Outlook action's `SelectedOption` value. Add Dataverse **Update a row** for the Order in each case:

| SelectedOption | `ht_installationresponsekey` |
|---|---|
| Accept installation | `accepted` |
| Request another time | `reschedule_requested` |
| Decline | `declined` |

In every case also set `ht_installationrespondedon` to `utcNow()`. Leave installation start and finish unchanged. In the **No** branch terminate with status `Cancelled` because the browser form has already saved the answer.

10. In trigger settings enable concurrency control with degree `1`. Save and test first with your own Microsoft 365 mailbox.

The action waits for a response, so its flow run can remain running until the customer answers. The secure browser link remains the universal fallback for unsupported email clients and captures an optional reason.

## End-to-end pilot check

1. Create/qualify an Enquiry and set Region to `Brighton`.
2. On the Opportunity verify Franchise Account is `Access4Lofts Brighton`.
3. Set Survey Start/Finish and assign a Surveyor whose Dynamics User has an internal email address. The Surveyor is always required.
4. Select **Send Surveyor Survey**.
5. Confirm Flow 1 emails the assigned Surveyor and requires that same surveyor to sign in.
6. Enter quantities for two products and submit.
7. In the Opportunity open the **Products** tab and verify exactly two Opportunity Products.
8. Open the **Quotes** tab and verify one draft Quote containing exactly two Quote Products with the Brighton GBP Price List.
9. Create/activate an Order from the Quote, enter installation start/finish, and select **Send Installation Confirmation**.
10. Confirm Flow 3 sends an email containing the three Outlook options and the secure fallback link.
11. Choose an option and verify the Order `ht_installationresponsekey` and `ht_installationrespondedon` fields update.
