import type { OpportunityContext, ProductOption } from "../domain/models.js";

export interface SurveyFormViewModel {
  token: string;
  context: OpportunityContext;
  scheduledStart: string;
  products: readonly ProductOption[];
}

export function renderSurveyForm(model: SurveyFormViewModel): string {
  const { context } = model;
  const franchise = context.region.name.replace(/^Access4Lofts\s*/i, "");
  const date = formatDate(model.scheduledStart);
  const rows = [...model.products]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(productRow)
    .join("");

  return page("Access4Lofts Survey and Quotation Form", `
    <form method="post" action="/api/survey/${encodeURIComponent(model.token)}" id="survey-form">
      <input type="hidden" name="response" value="accepted">
      <div class="document">
        <section class="sheet enquiry-sheet">
          ${header(franchise, context.region.telephone)}
          <h1>CUSTOMER ENQUIRY FORM</h1>
          <div class="field-grid enquiry-grid">
            ${readOnlyRow("Date", date)}
            ${readOnlyRow("Customer", context.customer.name)}
            ${textAreaRow("Address", "address", context.streetName ?? "", 3)}
            ${readOnlyRow("Postcode", context.propertyPostcode ?? "")}
            ${readOnlyRow("Mobile", context.customer.mobile ?? "")}
            ${readOnlyRow("Email", context.customer.email)}
            ${inputRow("Type of property", "propertyType")}
            ${inputRow("Age of property", "propertyAge")}
            ${inputRow("Where did you see our company advertised?", "advertisingSource")}
            ${inputRow("Existing hatch type", "existingHatchType")}
            ${inputRow("Flooring Required", "flooringRequired")}
            ${inputRow("Ladder Required", "ladderRequired")}
            ${inputRow("Light Required", "lightRequired")}
            ${inputRow("Insulation Required", "insulationRequired")}
            ${textAreaRow("Other Information", "otherInformation", "", 7)}
          </div>
          <label class="quotation-date"><strong>Quotation Date:</strong><input type="date" name="quotationDate"></label>
        </section>

        <section class="sheet survey-sheet">
          ${header(franchise, context.region.telephone, true)}
          <h2>ACCESS4LOFTS SURVEY AND QUOTATION FORM</h2>
          <div class="survey-fields">
            ${inputRow("House Type", "houseType")}
            ${inputRow("Roof Type", "roofType")}
            ${numberRow("Ceiling Height (to loft floor)", "ceilingHeightCm", "cm")}
            ${measurementRow("Hatch Size on top", "hatchTopWidthCm", "hatchTopLengthCm")}
            ${measurementRow("Hatch Size inside", "hatchInsideWidthCm", "hatchInsideLengthCm")}
            <div class="measure-complex"><span>Ladder Clearance</span><label>W<input type="number" name="ladderClearanceWidthCm" min="0" step="0.1"><small>cm</small></label><label>Arc clearance<input type="number" name="ladderArcClearanceCm" min="0" step="0.1"><small>cm</small></label><label>Arc Type<input type="text" name="ladderArcType" maxlength="100"></label></div>
          </div>
          <label class="large-box"><span>PLAN</span><textarea name="planNotes" rows="8" maxlength="4000"></textarea></label>
          <label class="large-box additional"><span>ADDITIONAL INFO</span><textarea name="additionalInfo" rows="4" maxlength="4000"></textarea></label>

          <div class="products-wrap">
            <table class="products">
              <thead><tr><th>DESCRIPTION</th><th>PRICE</th><th>QTY</th><th>TOTAL</th></tr></thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr><td rowspan="3" class="pricing-note">Prices shown are from the regional Dataverse price list.</td><th>Sub Total</th><td colspan="2"><output id="subtotal">£0.00</output></td></tr>
                <tr><th>VAT @ 20%</th><td colspan="2"><output id="vat-total">£0.00</output></td></tr>
                <tr><th>TOTAL FITTED PRICE</th><td colspan="2"><output id="grand-total">£0.00</output></td></tr>
              </tfoot>
            </table>
          </div>
          <div class="submit-area"><p>Enter a quantity only for products required on this opportunity.</p><button type="submit">Submit Survey &amp; Products</button></div>
        </section>
      </div>
    </form>`);
}

export function renderSurveyThanks(productCount: number): string {
  return page("Survey saved", `<main class="confirmation"><div class="brand-small">${logo()}</div><h1>Survey saved</h1><p>The survey information and ${productCount} product line${productCount === 1 ? "" : "s"} have been added to the opportunity.</p></main>`);
}

export function surveyPageHeaders(requestId: string): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; form-action 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "x-correlation-id": requestId
  };
}

function productRow(product: ProductOption): string {
  const id = escapeHtml(product.productId);
  const price = product.priceDisplayText?.trim() || `${product.priceIsIndicative ? "From " : ""}£${product.price.toFixed(2)}${product.unitName ? ` per ${product.unitName}` : ""}`;
  return `<tr class="product-row" data-unit-price="${product.price}"><td>${escapeHtml(product.name)}${product.description ? `<small>${escapeHtml(product.description)}</small>` : ""}</td><td>${escapeHtml(price)}</td><td><input aria-label="Quantity for ${escapeHtml(product.name)}" type="number" name="quantity_${id}" min="0" max="100000" step="0.001" inputmode="decimal"></td><td><output class="line-total">—</output></td></tr>`;
}

function header(franchise: string, telephone?: string, compact = false): string {
  return `<header class="form-header ${compact ? "compact" : ""}">${logo()}<div><div class="franchise">Access4Lofts ${escapeHtml(franchise)}</div>${telephone ? `<div class="telephone">Tel: ${escapeHtml(telephone)}</div>` : ""}</div></header>`;
}

function logo(): string {
  return `<svg class="logo" viewBox="0 0 180 110" role="img" aria-label="Access4Lofts"><rect width="180" height="110" rx="3" fill="#0969ad"/><path d="M108 42h14V26h-10l21-20 21 20h-10v33h-17v12h-17v15" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><text x="10" y="96" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#ffd400">Access</text><text x="83" y="96" font-family="Arial,sans-serif" font-size="23" font-weight="700" fill="#fff">4Lofts</text></svg>`;
}

function readOnlyRow(label: string, value: string): string { return `<div class="form-row"><span>${escapeHtml(label)}:</span><strong>${escapeHtml(value)}</strong></div>`; }
function inputRow(label: string, name: string): string { return `<label class="form-row"><span>${escapeHtml(label)}:</span><input type="text" name="${name}" maxlength="250"></label>`; }
function textAreaRow(label: string, name: string, value: string, rows: number): string { return `<label class="form-row multiline"><span>${escapeHtml(label)}:</span><textarea name="${name}" rows="${rows}" maxlength="4000">${escapeHtml(value)}</textarea></label>`; }
function numberRow(label: string, name: string, unit: string): string { return `<label class="form-row"><span>${escapeHtml(label)}:</span><span class="number-with-unit"><input type="number" name="${name}" min="0" step="0.1"><small>${unit}</small></span></label>`; }
function measurementRow(label: string, widthName: string, lengthName: string): string { return `<div class="measure-row"><span>${escapeHtml(label)}</span><label>W<input type="number" name="${widthName}" min="0" step="0.1"><small>cm</small></label><b>X</b><label>L<input type="number" name="${lengthName}" min="0" step="0.1"><small>cm</small></label></div>`; }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>
  :root{font-family:Arial,sans-serif;color:#f8f8f8;background:#10171d;color-scheme:dark}*{box-sizing:border-box}body{margin:0;padding:24px;background:#10171d}.document{max-width:1480px;margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:14px}.sheet{background:#262626;border:1px solid #858585;min-height:1040px;padding:26px}.form-header{display:grid;grid-template-columns:128px 1fr;align-items:start;gap:52px}.form-header.compact{grid-template-columns:92px 1fr;gap:70px}.logo{width:128px;height:auto}.compact .logo{width:92px}.franchise{font-size:25px;font-weight:700;margin-top:28px}.telephone{text-align:center;font-size:22px;font-weight:700;margin-top:32px}h1{text-align:center;font-size:23px;margin:30px 0}h2{text-align:center;font-size:14px;margin:23px 0}.field-grid,.survey-fields{border:1px solid #ddd}.form-row{display:grid;grid-template-columns:46% 54%;min-height:25px;border-bottom:1px solid #ddd;margin:0}.form-row:last-child{border-bottom:0}.form-row>span,.form-row>strong{padding:4px 7px;border-right:1px solid #ddd;font-size:13px}.form-row input,.form-row textarea{border:0;background:#262626;color:white;padding:4px 7px;width:100%;resize:vertical}.form-row.multiline{align-items:stretch}.form-row.multiline span{display:block}.number-with-unit{display:flex!important;padding:0!important}.number-with-unit input{flex:1}.number-with-unit small{padding:5px}.quotation-date{display:flex;gap:30px;margin:60px 0 0 120px}.quotation-date input{background:#262626;color:white;border:0;border-bottom:1px solid white}.measure-row,.measure-complex{display:grid;grid-template-columns:35% 1fr 20px 1fr;align-items:center;border-bottom:1px solid #ddd;font-size:12px;min-height:28px}.measure-row>span,.measure-complex>span{padding:5px}.measure-row label,.measure-complex label{display:flex;align-items:center;border-left:1px solid #ddd;height:100%;padding-left:4px}.measure-row input,.measure-complex input,.measure-complex input[type=text]{min-width:20px;width:100%;background:#262626;color:white;border:0;padding:4px}.measure-row small,.measure-complex small{padding:3px}.measure-row b{text-align:center}.measure-complex{grid-template-columns:35% 1fr 1.6fr 1.2fr}.large-box{display:block;border:1px solid #ddd;border-top:0}.large-box span{font-size:11px;padding:3px;display:block}.large-box textarea{display:block;width:100%;border:0;background:#262626;color:white;resize:vertical}.products-wrap{margin-top:0}.products{border-collapse:collapse;width:100%;font-size:11px}.products th,.products td{border:1px solid #ddd;padding:4px}.products th{text-align:center}.products th:first-child{width:64%}.products td:nth-child(2){width:17%;text-align:center}.products td:nth-child(3){width:7%}.products td:nth-child(4){width:12%;text-align:right}.products td small{display:block;color:#ccc;margin-top:2px}.products input{width:100%;border:0;background:#262626;color:white;text-align:center}.products output{white-space:nowrap}.products tfoot th{text-align:right;white-space:nowrap}.pricing-note{vertical-align:top;font-size:10px}.submit-area{text-align:right;margin-top:20px}.submit-area p{font-size:12px;color:#ddd}.submit-area button{background:#ffd400;color:#082f53;border:0;border-radius:4px;padding:13px 22px;font-weight:800;cursor:pointer}.confirmation{max-width:600px;background:#262626;border:1px solid #aaa;margin:12vh auto;padding:45px;text-align:center}.brand-small .logo{width:150px}.confirmation h1{color:#ffd400}.confirmation p{line-height:1.6}@media(max-width:900px){body{padding:8px}.document{grid-template-columns:1fr}.sheet{min-height:auto}.form-header{gap:24px}.form-header.compact{gap:35px}}@media(max-width:520px){.sheet{padding:14px}.form-header,.form-header.compact{grid-template-columns:80px 1fr;gap:14px}.logo,.compact .logo{width:80px}.franchise{font-size:18px;margin-top:15px}.telephone{font-size:16px;margin-top:18px}.form-row{grid-template-columns:44% 56%}.quotation-date{margin:35px 0}.products{font-size:9px}}
  @media print{:root,body{background:white;color:black;color-scheme:light}.sheet{background:white;color:black;break-after:page}.form-row input,.form-row textarea,.number-with-unit,.measure-row input,.measure-complex input,.large-box textarea,.products input{background:white;color:black}.document{display:block}.submit-area{display:none}}
  </style><script src="/survey-form.js" defer></script></head><body>${body}</body></html>`;
}
