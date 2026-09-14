# Regional product catalogue setup

## Confirmed source finding

A read-only Zoho CRM pull on 10 September 2026 returned:

- 4,862 Product rows;
- 3,144 active Product rows;
- 337 distinct active product names;
- repeated product names with different owners and prices;
- no readable Price Books data for the current Zoho integration user (`NO_PERMISSION`).

The Zoho Product owner is therefore useful migration evidence, but it is not a safe permanent region key. Before importing, Operations must approve a crosswalk from each Zoho Product Owner to one Dynamics Franchise Account. Do not commit the raw customer or product export to the public application repository.

### Brighton pilot candidate

Existing routing automation associates **Cristian Chelariu** with Brighton. The live Zoho pull returned exactly 30 active Products for that owner. The following is a candidate pilot order based on the existing Brighton quotation layout; Operations must approve it before import.

| Order | Product | Zoho price | Survey setting |
|---:|---|---:|---|
| 10 | New uPVC hatch (straight replace) | £124.17 | Show |
| 20 | New uPVC hatch (enlarge hatch size)* | £207.50 | Show |
| 30 | Relocate hatch and fit uPVC hatch* | £210.00 | Show |
| 40 | Adapt current hatch to drop down | £114.17 | Show |
| 50 | Supply and fit wooden drop down hatch | £232.50 | Show |
| 60 | Enlarge wooden hatch* | £260.00 | Show |
| 70 | Relocate hatch and fit wooden hatch* | £299.17 | Show |
| 80 | 2 section aluminium ladder | £180.00 | Show |
| 90 | 3 section easy stow aluminium ladder | £252.50 | Show |
| 100 | 2.6m telescopic ladder | £342.50 | Show |
| 110 | 2.9m telescopic ladder | £367.50 | Show |
| 120 | Deluxe Ladder (Over 3m) | £417.50 | Show |
| 130 | Eco S Line wooden ladder | £496.67 | Show |
| 140 | Boarding on a floating floor (96 x 44mm timber) | £60.00 | Show; confirm unit |
| 150 | Boarding on a Loft Prop floating floor | £63.33 | Show; confirm unit |
| 160 | 100mm Base Layer Insulation | £13.33 | Show; confirm unit |
| 170 | 150mm Top up Insulation | £14.17 | Hold: source description says 170mm |
| 180 | 200mm Top up Insulation | £15.00 | Show; confirm unit |
| 190 | Breathable Membrane - Straight | £12.50 | Show; confirm unit |
| 200 | Breathable Membrane - Hip | £12.50 | Show; confirm unit |
| 210 | Loft Lids | £11.67 | Show |
| 220 | Loft light - battery | £33.33 | Show |
| 230 | Shelving | £46.67 | Show; confirm unit |
| 240 | Balustrade | £44.17 | Show; confirm unit |
| 250 | Loft Clearance | £315.00 | Show; confirm pricing basis |
| 260 | Discount | £0.00 | Hold for pricing review |
| 270 | Misc | £0.00 | Hold for pricing review |
| 280 | Heading: First loft | £0.00 | Do not import as Product |
| 290 | Heading: Second loft | £0.00 | Do not import as Product |
| 300 | Heading: Third loft | £0.00 | Do not import as Product |

All rows above are displayed in Price List Item display order in the vertically scrollable form.

## Target relationship

```text
Opportunity -> Opportunity Price List -> Price List Items -> survey-enabled Products
```

Region and Franchise are related but not the same record:

- **Region** controls postcode/geographic routing.
- **Franchise Account** represents the responsible business.
- **Price List** controls which products that franchise can sell and the franchise price.
- **Product** is a shared master item and should not contain a Region lookup.

The survey requires the Opportunity's standard Price List. It includes only Price List Items whose related Product has **Show in Customer Survey = Yes**. Every included Product is shown in one vertically scrollable form ordered by **Survey Display Order**.

## Exact Dataverse configuration

### 1. Verify the Region-to-Franchise relationship

1. Open `make.powerapps.com` and select **HolaTeams development**.
2. Open **Solutions** > **HolaTeams Survey Automation Demo**.
3. Open **Tables** > **Region** > **Columns**.
4. Verify a lookup named **Franchise**, schema name `ht_Franchise`, targets **Account**.
5. Open each active Region row and populate **Franchise** with the responsible Franchise Account.
6. Do not create another Region/Franchise text field.

### 2. Create one Price List for each franchise

1. Open the Sales app > **Price Lists**.
2. Select **New**.
3. Name it `<Franchise name> - Standard`.
4. Set **Currency** to GBP for the current UK operation.
5. Save and activate it.
6. Open the related Franchise Account.
7. Set the standard **Default Price List** lookup to the newly created Price List and save.

For the immediate pilot, one Price List is enough. Assign that Price List directly to the pilot Opportunity.

### 3. Verify Product and Price List Item survey columns

Open **Tables** > **Product** > **Columns** and create this column if missing:

| Display name | Schema name | Type |
|---|---|---|
| Show in Customer Survey | `ht_ShowInCustomerSurvey` | Yes/No; default No |

Open **Tables** > **Price List Item** > **Columns** and create only any missing presentation columns:

| Display name | Schema name | Type |
|---|---|---|
| Survey Display Order | `ht_SurveyDisplayOrder` | Whole number |
| Survey Customer Description | `ht_SurveyCustomerDescription` | Multiline text; 1,000 |
| Survey Price Display Text | `ht_SurveyPriceDisplayText` | Text; 100 |
| Survey Price Is Indicative | `ht_SurveyPriceIsIndicative` | Yes/No; default No |

Add the visibility flag to the Product form. Add the four presentation fields to the Price List Item main form in a **Survey display** section and publish.

### 4. Load Products and franchise prices

1. Deduplicate the Zoho catalogue by approved stable SKU first; use normalized name only where a SKU is absent and the business confirms the records are the same item.
2. In Dynamics **Products**, create each approved shared Product once.
3. Populate **Product ID**, **Name**, **Description**, **Default Unit**, and **Default Unit Group**.
4. Set Product **Show in Customer Survey** to **Yes**, then activate the Product.
5. Open the franchise Price List and add one **Price List Item** for every product sold by that franchise.
6. Enter that franchise's approved amount and unit.
7. Set display order `10, 20, 30 ...`.
8. Use **Survey Price Display Text** for wording such as `From £207.50` or `Price on survey`.
9. Mark **Survey Price Is Indicative** when staff must review the figure before issuing a quote.

Do not import the same Zoho product 100 times merely because 100 Product Owners have copies. The franchise-specific value belongs on its Price List Item.

### 5. Verify the pilot Opportunity

1. Open the Opportunity.
2. Confirm **Region** is populated.
3. Confirm the Opportunity's standard **Price List** is populated.
4. Confirm **Contact**, **Surveyor**, **Survey Start**, **Street Name**, and **Property Postcode** are populated.
5. Save.
6. Request a new survey link. Existing links retain their earlier product snapshot and will not pick up a newly changed Price List.

## Migration controls

Use a reviewed staging sheet with these columns before any bulk import:

```text
ZohoProductId, ZohoProductOwner, ApprovedFranchiseAccount,
ApprovedProductNumber, ProductName, Description, Unit,
Price, Active, ShowInSurvey, SurveyDisplayOrder, PriceDisplayText, Indicative
```

Reject rather than guess when:

- Product Owner cannot be mapped to exactly one Franchise Account;
- two active rows have the same SKU but conflicting descriptions;
- price is zero or negative without an approved reason;
- unit is unknown;
- a franchise catalogue has duplicate Product + Unit rows.

## Runtime behaviour

1. The survey request resolves the Opportunity and Region.
2. It resolves the Opportunity Price List, or the Region's Franchise Account default Price List.
3. It snapshots every survey-enabled Price List Item into the signed survey session.
4. The page shows ten rows initially but searches all snapshotted rows.
5. A quantity greater than zero selects that Product.
6. Submission validates every selected Product against the immutable snapshot.
7. The API clears Opportunity Product rows, creates or reuses the draft Quote, and writes the validated selection directly to Quote Products.
