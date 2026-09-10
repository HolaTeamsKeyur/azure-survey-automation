# Zoho Word template assessment

## Outcome

Use one approved visual master for the new dynamic survey document, but do not automatically copy the Open XML header/footer or an arbitrary image from one regional Zoho export.

The exported documents look as if they share a header and footer, but most of that visible content is actually in the document body and media rather than the DOCX header/footer parts.

## Evidence reviewed

Source: `zoho-mail-merge-export`, generated 3 September 2026.

- 200 Writer documents were discovered and exported successfully.
- The export contains 43 distinct merge fields.
- 96 exported documents have names beginning with **Blank Enquiry**.
- 102 are other enquiry/supporting documents and two are quote-related.

Structural comparison of the 96 Blank Enquiry DOCX files found:

| Component | Result | Meaning |
|---|---:|---|
| Header XML | 2 variants | 95 files have the same empty header; Walsall contains a Company merge field |
| Footer XML | 1 variant | All 96 files have the same empty footer |
| Embedded media | 60 distinct file hashes | Visible logos/artwork are not one universal binary asset |
| Most common media asset | Used in 57 forms | Common, but not universal |
| Second most common media asset | Used in 25 forms | A second substantial branding/layout family exists |

The Walsall outlier is `Blank Enquiry Form Walsall.../source.docx`; its header contains the Zoho `Company` merge field. The common header/footer parts are otherwise empty paragraphs.

## Design consequence

The new canonical template should contain:

- one approved Access4Lofts logo and fixed visual header;
- dynamic Region name, telephone and sender email;
- one fixed customer/property block;
- one repeating `products` table row;
- fixed subtotal/VAT/grand-total positions;
- a fixed legal/pricing notice and footer.

The following must come from Dataverse rather than the template:

- Region/franchise contact details;
- Product availability;
- Product description and display order;
- regional unit price or approved indicative-price wording;
- selected quantity and immutable line snapshot.

VAT and authoritative quote totals remain blank in the survey worksheet until Finance approves the calculation. The final commercial quote should use Dynamics Quote and Quote Product values.

## Implemented baseline

`templates/survey-template.baseline.docx` is a generated, render-tested technical baseline. It already provides the fixed structure plus the repeating regional-product row.

It is not the final branded artifact. The design owner should choose one approved visual reference—or provide a current brand master—and then replace the baseline's plain styling without removing these tags:

```text
{customer_name}
{customer_email}
{customer_mobile}
{opportunity_name}
{region_name}
{region_telephone}
{region_email}
{street_name}
{property_postcode}
{survey_start}
{pricing_notice}
{#products}
{display_order}
{name}
{description}
{price_display}
{quantity}
{line_net}
{/products}
{subtotal}
{vat_total}
{grand_total}
```

## Approval needed before enabling attachments

Confirm only these visual/commercial items:

1. The approved logo/brand master.
2. Header and footer wording.
3. Whether the survey worksheet may display prices and subtotal.
4. The exact indicative-price disclaimer.
5. Whether VAT must remain absent or be displayed only after Quote review.

No region-specific product row should be retained in the canonical Word file.
