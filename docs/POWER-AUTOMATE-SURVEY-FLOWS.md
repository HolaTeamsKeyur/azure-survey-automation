# Power Automate survey flows

Use one authoritative writer for email and one authoritative writer for Quote creation. Do not enable the Azure and Power Automate writer for the same operation.

## Pilot settings

- Set Azure `SEND_SURVEY_EMAIL=false` when Flow 1 sends the email.
- Keep Azure `CREATE_QUOTE_ON_SUBMIT=true` for the fastest pilot; Flow 2 is then unnecessary.
- If Flow 2 must create the Quote, set Azure `CREATE_QUOTE_ON_SUBMIT=false` before enabling Flow 2.
- Regional pilot Price List: `Access4Lofts Brighton - GBP Survey`.

## Flow 1 - Opportunity - Send Customer Survey Link

1. Create an **Automated cloud flow** named `A4L - Opportunity - Send Customer Survey Link`.
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
<p>Please complete your Access4Lofts survey and select the products you require.</p>
<p><a href="@{body('Parse_JSON')?['formUrl']}">Open Survey &amp; Quotation Form</a></p>
<p>This secure link is specific to your enquiry and expires automatically.</p>
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

## End-to-end pilot check

1. Create/qualify an Enquiry and set Region to `Brighton`.
2. On the Opportunity verify Franchise Account is `Access4Lofts Brighton`.
3. Select a Surveyor with an internal email address.
4. Select **Send Customer Survey**.
5. Confirm Flow 1 sends exactly one email and the link opens the hosted form.
6. Enter quantities for two products and submit.
7. In the Opportunity open the **Products** tab and verify exactly two Opportunity Products.
8. Open the **Quotes** tab and verify one draft Quote containing exactly two Quote Products with the Brighton GBP Price List.

