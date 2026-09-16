import type { OpportunityContext, ProductOption } from "../domain/models.js";
import type { SurveyLayout, SurveySectionKey } from "../domain/surveyLayout.js";
import { SURVEY_CHOICE_OPTIONS, type SurveyChoiceOption } from "../domain/surveyChoices.js";

export interface SurveyFormViewModel {
  token: string;
  draftId?: string;
  context: OpportunityContext;
  scheduledStart: string;
  products: readonly ProductOption[];
  layout?: SurveyLayout;
  enableNewProductRequests?: boolean;
}

export function renderSurveyForm(model: SurveyFormViewModel): string {
  const { context } = model;
  const details = context.surveyDetails ?? {};
  const sortedProducts = [...model.products].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const location = brandLocation(context.region.franchiseName ?? context.region.name);
  const address = [context.streetName, context.propertyPostcode].filter(Boolean).join(", ") || "Address not provided";
  const surveyTitle = model.layout?.title || "Property survey";
  const property = section(model.layout, "property", "Survey details", "Check or update the information from the enquiry.");
  const measurements = section(model.layout, "measurements", "Measurements", "Enter measurements in centimetres.");
  const notes = section(model.layout, "notes", "Plan and notes");
  const productSection = section(model.layout, "products", "Products", "Select only the products required and enter their quantities.");

  return page("Access4Lofts Survey", `<form method="post" action="/api/survey/${encodeURIComponent(model.token)}" id="survey-form" data-draft-id="${escapeHtml(model.draftId ?? context.opportunityId)}">
    <header class="app-header"><div class="header-inner">${logo()}<div class="brand-copy"><strong>${escapeHtml(location)}</strong><span>Property survey</span></div></div></header>
    <main class="page-shell">
      <article class="form-sheet">
        <div class="form-title"><p>Customer survey worksheet</p><h1>${escapeHtml(surveyTitle)}</h1><span>Complete the form from top to bottom, then submit it to create the draft quote.</span></div>

        <section class="form-section" aria-labelledby="customer-heading"><div class="section-heading"><span>1</span><div><h2 id="customer-heading">Customer and appointment</h2><p>Information loaded from the Opportunity</p></div></div>
          <dl class="summary-table">${summaryItem("Customer", context.customer.name)}${summaryItem("Address", address)}${summaryItem("Appointment", formatDate(model.scheduledStart))}${summaryItem("Opportunity", context.name)}${summaryItem("Telephone", context.customer.mobile ?? "Not provided")}${summaryItem("Email", context.customer.email)}</dl>
        </section>

        ${property.visible ? `<section class="form-section" aria-labelledby="property-heading"><div class="section-heading"><span>2</span><div><h2 id="property-heading">${escapeHtml(property.title)}</h2>${help(property.helpText)}</div></div><div class="field-list">
          ${textAreaField("Survey address", "address", details.address ?? context.streetName, 2)}
          ${selectField("Type of property", "propertyType", details.propertyType, SURVEY_CHOICE_OPTIONS.propertyType)}${selectField("Age of property", "propertyAge", details.propertyAge, SURVEY_CHOICE_OPTIONS.propertyAge)}
          ${selectField("Existing hatch type", "existingHatchType", details.existingHatchType, SURVEY_CHOICE_OPTIONS.existingHatchType)}${selectField("Flooring required", "flooringRequired", details.flooringRequired, SURVEY_CHOICE_OPTIONS.flooringRequired)}
          ${selectField("Loft ladder required", "ladderRequired", details.ladderRequired, SURVEY_CHOICE_OPTIONS.ladderRequired)}${selectField("Light required", "lightRequired", details.lightRequired, SURVEY_CHOICE_OPTIONS.lightRequired)}
          ${selectField("Insulation required", "insulationRequired", details.insulationRequired, SURVEY_CHOICE_OPTIONS.insulationRequired)}${selectField("How did the customer hear about us?", "advertisingSource", details.advertisingSource, SURVEY_CHOICE_OPTIONS.advertisingSource)}
          ${textAreaField("Other information", "otherInformation", details.otherInformation, 3)}
        </div></section>` : ""}

        ${measurements.visible ? `<section class="form-section" aria-labelledby="measurements-heading"><div class="section-heading"><span>3</span><div><h2 id="measurements-heading">${escapeHtml(measurements.title)}</h2>${help(measurements.helpText)}</div></div><div class="field-list">
          ${inputField("House type", "houseType", details.houseType)}${inputField("Roof type", "roofType", details.roofType)}
          ${numberField("Ceiling height to loft floor", "ceilingHeightCm", details.ceilingHeightCm)}${numberField("Ladder clearance width", "ladderClearanceWidthCm", details.ladderClearanceWidthCm)}
          ${numberField("Ladder arc clearance", "ladderArcClearanceCm", details.ladderArcClearanceCm)}${inputField("Ladder arc type", "ladderArcType", details.ladderArcType)}
          ${dimensionField("Hatch size on top", "hatchTopWidthCm", "hatchTopLengthCm", details.hatchTopWidthCm, details.hatchTopLengthCm)}
          ${dimensionField("Hatch size inside", "hatchInsideWidthCm", "hatchInsideLengthCm", details.hatchInsideWidthCm, details.hatchInsideLengthCm)}
        </div></section>` : ""}

        ${notes.visible ? `<section class="form-section" aria-labelledby="notes-heading"><div class="section-heading"><span>4</span><div><h2 id="notes-heading">${escapeHtml(notes.title)}</h2>${help(notes.helpText)}</div></div><div class="field-list">
          ${textAreaField("Plan / sketch notes", "planNotes", details.planNotes, 5)}${textAreaField("Additional information", "additionalInfo", details.additionalInfo, 5)}${dateField("Proposed quotation date", "quotationDate", details.quotationDate)}
        </div></section>` : ""}

        ${productSection.visible ? `<section class="form-section products-section" aria-labelledby="products-heading"><div class="section-heading"><span>5</span><div><h2 id="products-heading">${escapeHtml(productSection.title)}</h2>${help(productSection.helpText)}<p class="source-note">Showing ${sortedProducts.length} survey-enabled product${sortedProducts.length === 1 ? "" : "s"} from this Opportunity's Price List.</p></div></div>
          <label class="product-search" for="product-search"><span>Search products</span><input id="product-search" type="search" placeholder="Search by product name or description" autocomplete="off"></label>
          <p class="product-result-count" id="product-result-count" aria-live="polite">Showing all ${sortedProducts.length} products</p>
          <div class="product-list">${sortedProducts.map(productRow).join("") || `<p class="empty-state">No survey-enabled products are available on this Opportunity's Price List.</p>`}</div>
          <p class="empty-state" id="no-product-results" hidden>No products match your search.</p>
          <div class="totals"><div><span>Subtotal</span><output id="subtotal">£0.00</output></div><div><span>VAT at 20%</span><output id="vat-total">£0.00</output></div><div class="grand"><span>Estimated total</span><output id="grand-total">£0.00</output></div></div>
          <p class="fine-print">Prices marked “From” or “indicative” must be reviewed before the quote is issued.</p>
        </section>` : ""}

        <section class="submit-section"><div><h2>Review and submit</h2><p><strong><span id="selected-product-count">0</span> products selected.</strong> Only these products will be added to the draft Quote. The Opportunity will not contain product lines.</p></div><p class="submission-status" id="submission-status" role="status" aria-live="polite" hidden></p><button class="primary" type="submit">Complete survey and create quote</button></section>
      </article>
    </main>
  </form>`);
}

export function renderSurveyThanks(productCount: number, requestedProductCount = 0, quoteUrl?: string): string {
  const outcome = requestedProductCount
    ? `${requestedProductCount} non-catalogue product request${requestedProductCount === 1 ? " is" : "s are"} waiting for office review.`
    : quoteUrl ? "A draft quote containing only the selected products has been created for office review." : "The office can now continue the quotation process.";
  const quoteAction = quoteUrl
    ? `<p class="confirmation-actions"><a class="quote-button" href="${escapeHtml(quoteUrl)}" target="_blank" rel="noopener noreferrer">Open quote in Dynamics 365</a></p>`
    : "";
  return page("Survey saved", `<main class="confirmation"><div class="brand-small">${logo()}</div><div class="success-mark">✓</div><h1>Survey completed</h1><p>${productCount} selected product line${productCount === 1 ? " was" : "s were"} saved.</p><p>${outcome}</p>${quoteAction}<p>You can close this window.</p></main>`);
}

export function surveyPageHeaders(requestId: string): Record<string, string> {
  return { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "x-correlation-id": requestId };
}

function productRow(product: ProductOption): string {
  const id = escapeHtml(product.productId);
  const price = product.priceDisplayText?.trim() || `${product.priceIsIndicative ? "From " : ""}£${product.price.toFixed(2)}${product.unitName ? ` per ${product.unitName}` : ""}`;
  const selected = product.selectedByDefault;
  const searchable = [product.name, product.description, product.unitName].filter(Boolean).join(" ").toLowerCase();
  return `<article class="product-row${selected ? " is-selected" : ""}" data-unit-price="${product.price}" data-product-search="${escapeHtml(searchable)}">
    <label class="product-choice"><input type="checkbox" name="selected_${id}" value="${id}"${selected ? " checked" : ""}><span><strong>${escapeHtml(product.name)}</strong>${product.description ? `<small>${escapeHtml(product.description)}</small>` : ""}<b>${escapeHtml(price)}</b></span></label>
    <label class="quantity"><span>Quantity${product.unitName ? ` (${escapeHtml(product.unitName)})` : ""}</span><input aria-label="Quantity for ${escapeHtml(product.name)}" type="number" name="quantity_${id}" min="0.001" max="100000" step="0.001" inputmode="decimal" value="${product.quantity || 1}"${selected ? "" : " disabled"}></label>
    <div class="line-summary"><span>Line total</span><output class="line-total">${selected ? formatMoney(product.price * product.quantity) : "—"}</output></div>
  </article>`;
}

function section(layout: SurveyLayout | undefined, key: SurveySectionKey, title: string, helpText?: string) {
  const configured = layout?.sections.find(item => item.key === key);
  return { title: configured?.title || title, helpText: configured?.helpText || helpText, visible: configured?.visible !== false };
}
function help(value?: string): string { return value ? `<p>${escapeHtml(value)}</p>` : ""; }
function summaryItem(label: string, value: string): string { return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`; }
function inputField(label: string, name: string, value?: string): string { return `<label class="field"><span>${escapeHtml(label)}</span><input type="text" name="${name}" maxlength="250" value="${escapeHtml(value ?? "")}"></label>`; }
function selectField(label: string, name: string, value: string | undefined, options: readonly SurveyChoiceOption[]): string {
  const normalizedValue = value?.trim().toLocaleLowerCase("en-GB");
  const hasSelectedValue = options.some(option => option.label.toLocaleLowerCase("en-GB") === normalizedValue);
  const placeholder = value && !hasSelectedValue ? `Select a valid option (current: ${value})` : "Select...";
  const optionHtml = options.map(option => {
    const selected = option.label.toLocaleLowerCase("en-GB") === normalizedValue ? " selected" : "";
    return `<option value="${escapeHtml(option.label)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
  return `<label class="field"><span>${escapeHtml(label)}</span><select name="${name}"><option value=""${hasSelectedValue ? "" : " selected"}>${escapeHtml(placeholder)}</option>${optionHtml}</select></label>`;
}
function textAreaField(label: string, name: string, value: string | undefined, rows: number): string { return `<label class="field"><span>${escapeHtml(label)}</span><textarea name="${name}" rows="${rows}" maxlength="4000">${escapeHtml(value ?? "")}</textarea></label>`; }
function numberField(label: string, name: string, value?: number): string { return `<label class="field"><span>${escapeHtml(label)}</span><div class="unit-input"><input type="number" name="${name}" min="0" max="100000" step="0.1" inputmode="decimal" value="${value ?? ""}"><span>cm</span></div></label>`; }
function dimensionField(label: string, widthName: string, lengthName: string, width?: number, length?: number): string { return `<fieldset class="dimension"><legend>${escapeHtml(label)}</legend><label><span>Width</span><div class="unit-input"><input type="number" name="${widthName}" min="0" max="100000" step="0.1" inputmode="decimal" value="${width ?? ""}"><span>cm</span></div></label><label><span>Length</span><div class="unit-input"><input type="number" name="${lengthName}" min="0" max="100000" step="0.1" inputmode="decimal" value="${length ?? ""}"><span>cm</span></div></label></fieldset>`; }
function dateField(label: string, name: string, value?: string): string { return `<label class="field"><span>${escapeHtml(label)}</span><input type="date" name="${name}" value="${escapeHtml(value ?? "")}"></label>`; }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date); }
function formatMoney(value: number): string { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
function logo(): string { return `<img class="brand-logo" src="/access4lofts-logo.svg" alt="Access4Lofts">`; }
function brandLocation(value: string): string {
  return value.trim().replace(/^access\s*4\s*lofts(?:\s*[-|:]\s*|\s+)?/i, "").trim() || "Your local team";
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)}</title><style>
  :root{font-family:Arial,"Segoe UI",sans-serif;color:#1d2a35;background:#eef2f5;color-scheme:light;--blue:#0871b9;--navy:#083b61;--yellow:#ffd31a;--line:#cfd8df;--muted:#5d6d78}*{box-sizing:border-box}body{margin:0;background:#eef2f5}button,input,textarea,select{font:inherit}.app-header{background:#fff;border-bottom:5px solid var(--blue)}.header-inner{max-width:820px;margin:auto;padding:10px 24px;display:flex;align-items:center;gap:14px}.brand-logo{display:block;width:112px;height:auto;flex:0 0 auto}.brand-copy{display:flex;flex-direction:column;padding-left:14px;border-left:1px solid var(--line)}.header-inner strong{color:var(--navy);font-size:18px}.header-inner span{color:var(--muted);font-size:12px}.page-shell{max-width:820px;margin:24px auto 60px;padding:0 16px}.form-sheet{background:#fff;border:1px solid var(--line);box-shadow:0 4px 18px #173c5414}.form-title{padding:30px 34px;border-bottom:2px solid var(--navy)}.form-title>p{margin:0 0 6px;text-transform:uppercase;letter-spacing:.12em;font-size:11px;font-weight:bold;color:var(--blue)}.form-title h1{margin:0 0 8px;color:var(--navy);font-size:29px}.form-title>span{color:var(--muted);font-size:14px}.form-section{padding:28px 34px;border-bottom:1px solid var(--line)}.section-heading{display:flex;align-items:flex-start;gap:12px;margin-bottom:20px}.section-heading>span{flex:0 0 28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--navy);color:#fff;font-weight:bold}.section-heading h2{margin:1px 0 4px;color:var(--navy);font-size:20px}.section-heading p{margin:0;color:var(--muted);font-size:13px;line-height:1.4}.section-heading .source-note{margin-top:5px;color:var(--blue);font-weight:bold}.summary-table{margin:0;border:1px solid var(--line)}.summary-table>div{display:grid;grid-template-columns:160px minmax(0,1fr);border-bottom:1px solid var(--line)}.summary-table>div:last-child{border-bottom:0}.summary-table dt,.summary-table dd{margin:0;padding:10px 12px;overflow-wrap:anywhere}.summary-table dt{background:#f2f5f7;color:var(--muted);font-size:12px;font-weight:bold}.summary-table dd{border-left:1px solid var(--line);font-size:14px}.field-list{display:flex;flex-direction:column;gap:17px}.field{display:flex;flex-direction:column;gap:7px}.field>span,.dimension legend,.dimension label>span,.quantity>span,.line-summary>span{font-size:12px;color:var(--muted);font-weight:bold}.field input,.field textarea,.field select,.quantity input{width:100%;border:1px solid #aebcc6;border-radius:4px;background:#fff;color:#1d2a35;padding:10px 11px;outline:0}.field input:focus,.field textarea:focus,.field select:focus,.quantity input:focus{border-color:var(--blue);box-shadow:0 0 0 3px #0871ba1c}.field textarea{resize:vertical;overflow:hidden}.unit-input{display:flex;border:1px solid #aebcc6;border-radius:4px;overflow:hidden}.unit-input input{width:100%;border:0;padding:10px 11px;outline:0}.unit-input>span{display:grid;place-items:center;padding:0 12px;background:#f2f5f7;color:var(--muted);border-left:1px solid var(--line)}.dimension{margin:0;border:1px solid var(--line);padding:16px;display:flex;flex-direction:column;gap:14px}.dimension legend{padding:0 6px}.dimension label{display:flex;flex-direction:column;gap:6px}.product-list{display:flex;flex-direction:column;gap:14px}.product-row{border:1px solid var(--line);padding:16px;break-inside:avoid}.product-row.is-selected{border-color:var(--blue);box-shadow:inset 4px 0 var(--blue);background:#f8fcff}.product-choice{display:flex;align-items:flex-start;gap:11px;cursor:pointer}.product-choice input{width:19px;height:19px;margin:1px 0 0;accent-color:var(--blue);flex:0 0 auto}.product-choice>span{display:flex;flex-direction:column;gap:4px}.product-choice strong{color:var(--navy);font-size:15px}.product-choice small{color:var(--muted);line-height:1.4}.product-choice b{color:var(--blue);font-size:13px}.quantity,.line-summary{display:flex;flex-direction:column;gap:6px;margin:14px 0 0 30px}.quantity input{max-width:260px}.quantity input:disabled{background:#edf1f3;color:#7d8991}.line-total{font-weight:bold;color:var(--navy)}.empty-state{padding:20px;background:#f4f6f7;color:var(--muted);text-align:center}.totals{margin:22px 0 0 30px;border-top:1px solid var(--line);padding-top:8px}.totals div{display:flex;justify-content:space-between;padding:6px 0}.totals .grand{font-size:18px;color:var(--navy);font-weight:bold;border-top:1px solid var(--line);margin-top:4px;padding-top:11px}.fine-print{color:var(--muted);font-size:12px;line-height:1.5;margin:12px 0 0 30px}.submit-section{padding:28px 34px;background:#f6f8fa;display:flex;flex-direction:column;align-items:flex-start;gap:16px}.submit-section h2{margin:0 0 5px;color:var(--navy);font-size:20px}.submit-section p{margin:0;color:var(--muted);line-height:1.5}.primary{border-radius:4px;padding:13px 20px;font-weight:bold;cursor:pointer;background:var(--yellow);color:var(--navy);border:1px solid #ddb700}.primary:disabled{cursor:wait;opacity:.65}.confirmation{max-width:620px;background:white;border:1px solid var(--line);margin:10vh auto;padding:45px;text-align:center;box-shadow:0 8px 30px #163e5617}.brand-small{display:flex;justify-content:center}.brand-small .brand-logo{width:140px}.success-mark{width:56px;height:56px;display:grid;place-items:center;margin:24px auto 10px;background:#e5f6ed;color:#147a42;border-radius:50%;font-size:28px;font-weight:900}.confirmation h1{color:var(--navy)}.confirmation p{line-height:1.6;color:var(--muted)}
  .confirmation-actions{margin:24px 0}.quote-button{display:inline-flex;align-items:center;justify-content:center;border-radius:4px;padding:13px 22px;font-weight:bold;text-decoration:none;background:var(--yellow);color:var(--navy);border:1px solid #ddb700}.quote-button:hover{background:#ffe05a}
  [hidden]{display:none!important}.submission-status{padding:11px 13px;border-radius:4px;background:#e8f3fb;color:var(--navy)!important;width:100%}.submission-status.is-error{background:#fff0f0;color:#9d1c1c!important;border:1px solid #e4b3b3}.product-search{display:flex;flex-direction:column;gap:7px;margin-bottom:7px}.product-search>span{font-size:12px;color:var(--muted);font-weight:bold}.product-search input{width:100%;border:1px solid #aebcc6;border-radius:4px;padding:11px 12px;outline:0}.product-search input:focus{border-color:var(--blue);box-shadow:0 0 0 3px #0871ba1c}.product-result-count{margin:0 0 14px;color:var(--muted);font-size:12px}.product-row{display:grid;grid-template-columns:minmax(0,1fr) 150px 105px;gap:18px;align-items:center}.product-choice{min-width:0}.product-choice>span{min-width:0}.quantity,.line-summary{margin:0}.quantity input{max-width:none}.line-summary{text-align:right;align-items:flex-end}
  @media(max-width:700px){.product-row{grid-template-columns:1fr}.quantity,.line-summary{margin-left:30px}.line-summary{text-align:left;align-items:flex-start}}
  @media(max-width:560px){.page-shell{padding:0;margin:0}.form-sheet{border-left:0;border-right:0}.form-title,.form-section,.submit-section{padding:23px 18px}.summary-table>div{grid-template-columns:1fr}.summary-table dd{border-left:0;border-top:1px solid var(--line)}.totals,.fine-print{margin-left:30px}.primary{width:100%}}
  @media print{body{background:#fff}.app-header{border-bottom:2px solid var(--blue)}.page-shell{max-width:none;margin:0;padding:0}.form-sheet{border:0;box-shadow:none}.form-title{padding-top:18px}.product-search,.product-result-count,.submit-section{display:none}.field input,.field textarea,.quantity input,.unit-input{box-shadow:none!important}.product-row{page-break-inside:avoid}.product-row[hidden]{display:grid!important}}
  </style><script src="/survey-form.js" defer></script></head><body>${body}</body></html>`;
}
