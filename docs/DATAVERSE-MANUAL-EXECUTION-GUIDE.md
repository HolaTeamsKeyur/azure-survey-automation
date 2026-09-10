# Dataverse manual execution guide

Use this as the click-by-click build sheet in **HolaTeams development**. It deliberately keeps the Dataverse work manual and gives the Azure application only the fields it needs.

Do not perform these steps in Access4Lofts production. Menu wording can vary slightly with maker-portal releases, but the table, column and function names below must remain exact.

## 1. Confirm the target and make a rollback copy

1. Open `https://make.powerapps.com`.
2. In the environment picker, select **HolaTeams development**.
3. Confirm the environment URL is `https://holateams-operations.crm.dynamics.com/`.
4. Open **Solutions**.
5. Export an unmanaged backup of the current owning solution(s) for the Opportunity and Order forms before editing them.
6. Create or open the unmanaged solution **HolaTeams Survey Automation Demo**.
7. Use the existing HolaTeams publisher whose prefix is `ht`. Do not create the columns under the default publisher.

## 2. Add only the existing tables that will be changed

Inside **HolaTeams Survey Automation Demo**:

1. Select **Add existing** > **Table**.
2. Select **Opportunity** and choose **Edit objects**.
3. Add only the main form that will be edited. Do not select **Include all objects**.
4. Repeat for **Order**. Its Dataverse logical name is `salesorder`; the visible label may be **Order** or **Order Confirmation**.
5. Repeat for **Price List Item**. Its logical name is `productpricelevel`.
6. Add **Opportunity Product** only if you are implementing the optional line-review columns in section 6.
7. Select **Add** and wait for the components to appear in the solution.

Create every new column from this solution, not from an unmanaged default solution.

## 3. Create the Opportunity columns

Open **Objects** > **Tables** > **Opportunity** > **Schema** > **Columns**. For every row below:

1. Select **New column**.
2. Enter the display name.
3. Expand **Advanced options** and confirm the schema name is exactly as shown.
4. Select the stated data type and settings.
5. Keep **Required** set to **Optional**.
6. Enable auditing only when the row says **Yes**.
7. Select **Save** before creating the next column.

| Display name | Schema name | Data type and settings | Audit | Placement/security |
|---|---|---|---|---|
| Survey Send Requested On | `ht_SurveySendRequestedOn` | Date and time; User local | Yes | Visible, read-only |
| Survey Automation Status | `ht_SurveyAutomationStatusKey` | Text; 50 characters | Yes | Visible, read-only |
| Survey Recipient Email | `ht_SurveyRecipientEmail` | Text; format Email; 200 characters | Yes | Visible, read-only |
| Survey Response Expires At | `ht_SurveyExpiresAt` | Date and time; Time-zone independent | Yes | Visible, read-only |
| Survey Token ID | `ht_SurveyTokenId` | Text; 100 characters | Yes | Never put on the normal form; secure |
| Survey Allowed Product IDs | `ht_SurveyAllowedProductIds` | Multiline text; 100,000 characters | No | Never put on the normal form; secure |
| Survey Products Snapshot | `ht_SurveyProductsSnapshotJson` | Multiline text; 1,000,000 characters | No | Never put on the normal form; secure |
| Survey Selected Product IDs | `ht_SurveySelectedProductIds` | Multiline text; 100,000 characters | Yes | Visible, read-only |
| Survey Selection Snapshot | `ht_SurveySelectionSnapshotJson` | Multiline text; 1,000,000 characters | Yes | Admin only; secure |
| Survey Product Review Status | `ht_SurveyProductReviewStatusKey` | Text; 30 characters | Yes | Visible, read-only |
| Survey Response Reason | `ht_SurveyResponseReason` | Multiline text; 4,000 characters | Yes | Visible, read-only |
| Survey Feedback Score | `ht_SurveyFeedbackScore` | Whole number; minimum 1; maximum 5 | Yes | Visible, read-only |
| Survey Feedback Comments | `ht_SurveyFeedbackComments` | Multiline text; 4,000 characters | Yes | Visible, read-only |
| Survey Responded On | `ht_SurveyRespondedOn` | Date and time; User local | Yes | Visible, read-only |
| Survey Document Reference | `ht_SurveyDocumentReference` | Text; 500 characters | Yes | Visible, read-only; secure |
| Survey Automation Last Error | `ht_SurveyAutomationLastError` | Multiline text; 4,000 characters | Yes | Admin only; secure |

After saving, open each column once and verify its lower-case logical name matches the equivalent name in `assets/DATAVERSE-FIELDS.csv`. Once a schema name is committed, do not delete and recreate it casually; integrations depend on the logical name.

## 4. Create the Order columns

Open **Tables** > **Order** > **Schema** > **Columns** and use the same **New column** process.

| Display name | Schema name | Data type and settings | Audit | Placement/security |
|---|---|---|---|---|
| Installation Confirmation Requested On | `ht_InstallationConfirmationRequestedOn` | Date and time; User local | Yes | Visible, read-only |
| Installation Customer Response | `ht_InstallationResponseKey` | Text; 50 characters | Yes | Visible, read-only |
| Installation Recipient Email | `ht_InstallationRecipientEmail` | Text; format Email; 200 characters | Yes | Visible, read-only |
| Installation Response Expires At | `ht_InstallationResponseExpiresAt` | Date and time; Time-zone independent | Yes | Visible, read-only |
| Installation Response Token ID | `ht_InstallationResponseTokenId` | Text; 100 characters | Yes | Never put on the normal form; secure |
| Installation Response Reason | `ht_InstallationResponseReason` | Multiline text; 4,000 characters | Yes | Visible, read-only |
| Installation Responded On | `ht_InstallationRespondedOn` | Date and time; User local | Yes | Visible, read-only |
| Installation Response Last Error | `ht_InstallationResponseLastError` | Multiline text; 4,000 characters | Yes | Admin only; secure |

## 5. Create the Price List Item columns

Open **Tables** > **Price List Item** > **Schema** > **Columns**. These fields control the dynamic product rows in the survey. They replace hard-coded regional rows in the old Word files.

| Display name | Schema name | Data type and settings | Default | Audit |
|---|---|---|---|---|
| Show in Customer Survey | `ht_ShowInCustomerSurvey` | Yes/No | Yes | Yes |
| Survey Display Order | `ht_SurveyDisplayOrder` | Whole number; minimum 0; maximum 100,000 | blank | Yes |
| Survey Customer Description | `ht_SurveyCustomerDescription` | Multiline text; 1,000 characters | blank | Yes |
| Survey Price Display Text | `ht_SurveyPriceDisplayText` | Text; 100 characters | blank | Yes |
| Survey Price Is Indicative | `ht_SurveyPriceIsIndicative` | Yes/No | No | Yes |

Do not add region columns directly to Product. The regional Price List determines whether a Product is offered and what price applies.

## 6. Optional Opportunity Product review columns

Create these only when the team wants the customer's selections copied to Opportunity Product rows for staff review. The submitted JSON snapshot remains the source evidence even when these columns are used.

Open **Tables** > **Opportunity Product** > **Schema** > **Columns**:

| Display name | Schema name | Data type and settings | Default | Audit |
|---|---|---|---|---|
| Customer Requested | `ht_CustomerRequested` | Yes/No | No | Yes |
| Customer Requested Quantity | `ht_CustomerRequestedQuantity` | Decimal number; precision 3 | blank | Yes |
| Survey Selection Note | `ht_SurveySelectionNote` | Multiline text; 1,000 characters | blank | Yes |

Do not auto-create commercial Quote lines from anonymous browser input. Keep the Opportunity status at `pending_review`; a staff member verifies quantity, price and VAT before using the existing Quote process.

## 7. Build the Opportunity form section

1. In the solution, open **Opportunity** > **Forms**.
2. Open the main form used by the HolaSales Operations app.
3. Add a one- or two-column section beneath the existing survey details and name it **Customer Survey Automation**.
4. Add these controls in this order:
   - Survey Automation Status
   - Survey Send Requested On
   - Survey Recipient Email
   - Survey Response Expires At
   - Survey Responded On
   - Survey Product Review Status
   - Survey Selected Product IDs
   - Survey Response Reason
   - Survey Feedback Score
   - Survey Feedback Comments
   - Survey Document Reference
5. Select each control and enable its read-only/locked property. This is user-interface protection only; section 11 provides real column security.
6. Keep the section collapsed by default if the normal sales form is already crowded.
7. Do not add Token ID, Allowed Product IDs, Products Snapshot, Selection Snapshot or Last Error to the normal sales form.
8. If Opportunity Products are used, add `Customer Requested` and `Customer Requested Quantity` to the staff review view/subgrid. Keep `Survey Selection Note` on the Opportunity Product form.
9. Select **Save and publish**.

## 8. Build the Order form section

1. Open **Order** > **Forms** and edit the main Order Confirmation form used by the app.
2. Add a section below the existing installation details named **Customer Installation Confirmation**.
3. Add these controls in order:
   - Installation Customer Response
   - Installation Confirmation Requested On
   - Installation Recipient Email
   - Installation Response Expires At
   - Installation Responded On
   - Installation Response Reason
4. Lock the controls as read-only.
5. Do not add the token or last-error fields to the normal form.
6. Select **Save and publish**.

## 9. Build the Price List Item form section

1. Open **Price List Item** > **Forms** and edit the form used by product administrators.
2. Add a section named **Customer Survey Display**.
3. Add all five fields from section 5.
4. Put **Show in Customer Survey** and **Survey Display Order** first because administrators use them most often.
5. Select **Save and publish**.

## 10. Upload the JavaScript web resource

The source file is `power-platform/HolaTeamsSurveyAutomationDemo/assets/ht_surveyautomationcommands.js`.

1. In the solution, select **New** > **More** > **Web resource**.
2. Set **Name** to `ht_surveyautomationcommands.js`.
3. Set **Display name** to **HolaTeams Survey Automation Commands**.
4. Set **Type** to **JavaScript (JS)**.
5. Upload the source file.
6. Select **Save**, then **Publish**.

The code intentionally has no Azure URL or shared secret. It saves the record and updates only the request timestamp through `Xrm.WebApi`; the Dataverse webhook owns the secret.

## 11. Add the two command buttons

Use the modern command designer for the first pilot.

### Opportunity button

1. Open **Apps** and edit the HolaSales Operations model-driven app.
2. In the left navigation, select the Opportunity page/table, open the ellipsis menu and select **Edit command bar**.
3. Choose **Main form**.
4. Select **New** > **Command**.
5. Set label to **Send Customer Survey**.
6. Under **Action**, select **Run JavaScript**.
7. Add library `ht_surveyautomationcommands.js`.
8. Set function to `HT.SurveyAutomation.requestSurvey`.
9. Add the parameter **PrimaryControl**.
10. Set visibility to **Show** for the pilot.
11. Save and publish the command and app.

The JavaScript blocks unsaved/new records, missing Contact/Region/Surveyor, and duplicate open requests. If you later use Ribbon Workbench/classic commands, use `HT.SurveyAutomation.canRequestSurvey` as the custom enable rule. It is not a modern command-designer field.

### Order button

Repeat the process for Order:

- Label: **Send Installation Confirmation**
- Function: `HT.SurveyAutomation.requestInstallation`
- Library: `ht_surveyautomationcommands.js`
- Parameter: **PrimaryControl**
- Visibility: **Show** for the pilot

The JavaScript requires Customer Contact, installation start and finish, finish after start, and no open/accepted request. For an optional classic enable rule use `HT.SurveyAutomation.canRequestInstallation`.

### Optional refresh button

On the Opportunity main form command bar, add **Refresh Survey Status**, run `HT.SurveyAutomation.refresh`, and pass **PrimaryControl**. This is optional because browser refresh also works.

## 12. Configure auditing and field security

### Auditing

1. Confirm environment auditing is enabled under the environment audit settings.
2. Open each relevant table and enable table auditing.
3. Open each column marked **Audit = Yes** above and enable column auditing.
4. Leave the large allowed-products and product-snapshot fields unaudited; their changes are represented by the response/status evidence and auditing very large JSON creates avoidable storage.

### Column security

Enable column security on the fields marked **secure** in sections 3 and 4. Then:

1. Open **Settings** > **Users + permissions** > **Column security profiles**.
2. Create **HolaTeams Survey Automation Protected Data**.
3. Grant only approved system administrators and the Azure application user the required read/update permissions.
4. Normal sales users should not read token IDs, product allow-lists, snapshots or detailed automation errors.
5. Verify the Azure app user can update the response and status fields. If you secure those visible fields later, add explicit profile permissions first.

Do not rely on a locked form control as a security boundary.

## 13. Configure regional Products and Price Lists

Use a single Product master and one standard Price List per commercial region/franchise.

### Product master

1. In the Sales app, open **Products**.
2. Create or deduplicate each sellable Product once.
3. Give each Product a stable Product ID/number, customer-facing name, default unit and unit group.
4. Activate the Product.

### Regional Price Lists

For every region, such as Bristol or Manchester:

1. Open **Price Lists** and create or open its standard Price List.
2. Confirm the currency.
3. Add a Price List Item for every Product offered in that region.
4. Enter the approved regional amount and pricing method.
5. On **Customer Survey Display**, set:
   - **Show in Customer Survey** = Yes only when the customer may select it.
   - **Survey Display Order** = 10, 20, 30 and so on, leaving gaps for additions.
   - **Survey Customer Description** = approved regional wording, or blank to use the Product description.
   - **Survey Price Display Text** = optional wording such as `From £120` or `Price on survey`; leave blank to display the actual Price List amount.
   - **Survey Price Is Indicative** = Yes when the displayed value is not a binding quote.
6. Set **Show in Customer Survey** = No rather than deleting an item that should disappear from new surveys.

Link the Opportunity's Region to the correct franchise/account and ensure that record resolves to the correct default Price List. The Azure request takes an immutable product/price snapshot when the email is generated, so later price changes do not alter a customer's already-issued form.

### Data reconciliation

For each region, compare the resulting list with its old Word survey:

- every offered Product exists once;
- hidden Products do not appear;
- units and prices match;
- customer descriptions are approved;
- indicative-price wording is correct;
- sort order matches the intended worksheet.

## 14. Register the Dataverse webhooks after Azure exists

Do not do this section until the Azure API has a stable HTTPS hostname and an automation key stored in Azure configuration.

Use Microsoft's Plug-in Registration Tool and register two webhooks with **HttpHeader** authentication. Store the secret as header name `x-automation-key`; never place it in JavaScript.

### Survey webhook step

| Setting | Value |
|---|---|
| Name | HolaTeams Survey Request |
| URL | `https://YOUR-HOST/api/events/opportunity-ready` |
| Message | Update |
| Primary table | `opportunity` |
| Filtering attributes | `ht_surveysendrequestedon` |
| Stage | PostOperation |
| Execution mode | Asynchronous |
| Execution order | 10 |

### Installation webhook step

| Setting | Value |
|---|---|
| Name | HolaTeams Installation Confirmation Request |
| URL | `https://YOUR-HOST/api/events/installation-ready` |
| Message | Update |
| Primary table | `salesorder` |
| Filtering attributes | `ht_installationconfirmationrequestedon` |
| Stage | PostOperation |
| Execution mode | Asynchronous |
| Execution order | 10 |

The filtering attributes are essential: without them, unrelated updates can cause email sends. After registration, rotate the key by changing Azure and webhook registration together.

## 15. Check existing automation before enabling sends

In the current HolaSales solutions, identify and temporarily isolate any flow or plug-in that already sends:

- survey appointments or invitations;
- installation appointment create/update messages;
- SMS reminders;
- feedback requests.

Do not let the old automation and this webhook own the same event. Record which automation remains authoritative for appointment creation, email, SMS and downstream status changes.

## 16. Publish and test in this order

1. Select **Publish all customizations** in the solution.
2. Open an existing Opportunity with Contact, Region and Surveyor.
3. Confirm the new section loads and protected fields are not editable.
4. Select **Send Customer Survey** once.
5. Verify `Survey Send Requested On` changes.
6. After the webhook is live, verify status progresses to `sent` or the admin error field records a controlled failure.
7. Open the signed browser link in a private browser.
8. Verify only products from the resolved regional Price List appear.
9. Submit accept, decline and reschedule test cases; verify each is idempotent and expired/tampered tokens fail.
10. Verify an accepted product selection is stored with status `pending_review` and does not silently create an approved quote.
11. Repeat on Order with valid installation dates.
12. Verify a reschedule response records the reason but does not change dates automatically.
13. Test as a normal sales user, system administrator and the Azure application user.
14. Export the completed unmanaged solution and retain it as the source artifact for promotion.

## 17. Fastest division of work

You can safely do these now while the Azure work continues:

1. Sections 1–9: solution, columns and form sections.
2. Sections 10–11: JavaScript web resource and command buttons.
3. Sections 12–13: security and regional Price List data.

Wait for the Azure hostname/key before section 14. Run sections 15–16 together with the integration deployment.

## 18. Source assets and official references

Local machine-readable manifests:

- `power-platform/HolaTeamsSurveyAutomationDemo/assets/DATAVERSE-FIELDS.csv`
- `power-platform/HolaTeamsSurveyAutomationDemo/assets/COMMAND-BAR-DEFINITIONS.csv`
- `power-platform/HolaTeamsSurveyAutomationDemo/assets/WEBHOOK-STEPS.csv`
- `power-platform/HolaTeamsSurveyAutomationDemo/assets/ht_surveyautomationcommands.js`

Microsoft references:

- [Create a solution](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-solution)
- [Create and edit Dataverse columns](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/fields-overview)
- [Create and edit model-driven app forms](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/create-and-edit-forms)
- [Use the modern command designer](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/use-command-designer)
- [Manage commands in solutions](https://learn.microsoft.com/en-us/power-apps/maker/model-driven-apps/manage-commands-in-solutions)

