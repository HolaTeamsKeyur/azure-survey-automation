import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { correlationId, publicFormErrorMessage } from "../http/responses.js";
import { verifySurveyToken } from "../security/tokens.js";
import { SurveyAutomationService } from "../services/surveyAutomation.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    const token = String(request.params.token ?? "");
    const claims = await verifySurveyToken(config, token);
    const service = new SurveyAutomationService(config);
    if (request.method === "GET") {
      const model = await service.getSurveyForm(claims);
      return { status: 200, headers: securityHeaders(requestId), body: renderForm(token, model.session.scheduledStart, model.products, model.session.selectedProductIds) };
    }
    const form = await request.formData();
    const response = String(form.get("response") ?? "accepted") as "accepted" | "declined" | "reschedule_requested";
    if (!(["accepted", "declined", "reschedule_requested"] as string[]).includes(response)) throw new Error("Invalid response.");
    const selectedProductIds = form.getAll("products").map(String);
    const productSelections = selectedProductIds.map(productId => ({
      productId,
      quantity: quantity(form.get(`quantity_${productId}`)),
      note: optional(form.get(`note_${productId}`))
    }));
    const result = await service.submitSurvey({
      sessionId: claims.sessionId,
      response,
      selectedProductIds,
      productSelections,
      reason: optional(form.get("reason")),
      feedbackScore: numberOptional(form.get("feedbackScore")),
      feedbackComments: optional(form.get("feedbackComments"))
    }, claims);
    return { status: 200, headers: securityHeaders(requestId), body: renderThanks(result.status) };
  } catch (error) {
    context.error(`Survey form request failed. Correlation ID: ${requestId}`, error);
    return { status: 400, headers: securityHeaders(requestId), body: renderError(publicFormErrorMessage()) };
  }
}

app.http("surveyForm", { methods: ["GET", "POST"], authLevel: "anonymous", route: "survey/{token}", handler });

function renderForm(token: string, scheduledStart: string, products: Array<{ productId: string; name: string; description?: string; price: number; priceDisplayText?: string; priceIsIndicative?: boolean; unitName?: string; quantity: number }>, selected: string[]): string {
  const selectedSet = new Set(selected.map(x => x.toLowerCase()));
  const choices = products.map(product => {
    const productId = escapeHtml(product.productId);
    const checked = selectedSet.has(product.productId.toLowerCase()) ? "checked" : "";
    const price = product.priceDisplayText?.trim() || `${product.priceIsIndicative ? "From " : ""}£${product.price.toFixed(2)}${product.unitName ? ` / ${product.unitName}` : ""}`;
    return `<div class="product"><label class="pick"><input type="checkbox" name="products" value="${productId}" ${checked}><span><strong>${escapeHtml(product.name)}</strong><br><small>${escapeHtml(product.description ?? "")}</small><br><span class="price">${escapeHtml(price)}</span></span></label><label>Requested quantity<input type="number" name="quantity_${productId}" value="${product.quantity}" min="0.001" max="100000" step="0.001" inputmode="decimal"></label><label>Product note<input type="text" name="note_${productId}" maxlength="500"></label></div>`;
  }).join("");
  return page("Customer survey", `<h1>Your Access4Lofts survey</h1><p>Proposed time: <strong>${escapeHtml(scheduledStart)}</strong></p><form method="post" action="/api/survey/${encodeURIComponent(token)}"><fieldset><legend>Products to discuss</legend>${choices}</fieldset><label>Response<select name="response"><option value="accepted">Accept and submit</option><option value="reschedule_requested">Request another time</option><option value="declined">Decline</option></select></label><label>Message or reason<textarea name="reason" maxlength="2000"></textarea></label><label>Survey experience (1–5)<input type="number" name="feedbackScore" min="1" max="5" step="1"></label><label>Feedback<textarea name="feedbackComments" maxlength="2000"></textarea></label><button type="submit">Submit securely</button></form>`);
}
function renderThanks(status: string): string { return page("Response saved", `<h1>Thank you</h1><p>Your response was saved. Status: ${escapeHtml(status)}.</p>`); }
function renderError(message: string): string { return page("Unable to continue", `<h1>Unable to continue</h1><p>${escapeHtml(message)}</p><p>Please contact your local Access4Lofts team.</p>`); }
function page(title: string, body: string): string { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#17202a}label,.product{display:block;margin:1rem 0;padding:.75rem}fieldset{border:1px solid #ccd1d1}textarea,select,input[type=number],input[type=text]{display:block;width:100%;max-width:34rem;padding:.6rem;margin-top:.4rem}button{background:#0866b5;color:white;border:0;padding:.8rem 1.2rem;border-radius:.3rem}.product{background:#f7f9f9;border:1px solid #e1e8ed;border-radius:.35rem}.pick{display:flex;gap:.75rem;padding:0;margin:0}.price{font-weight:700}</style></head><body>${body}</body></html>`; }
function securityHeaders(requestId: string): Record<string, string> { return { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "x-correlation-id": requestId }; }
function optional(value: FormDataEntryValue | null): string | undefined { const result = String(value ?? "").trim(); return result || undefined; }
function numberOptional(value: FormDataEntryValue | null): number | undefined { const result = Number(value); return Number.isFinite(result) && result >= 1 && result <= 5 ? result : undefined; }
function quantity(value: FormDataEntryValue | null): number { const result = Number(value); if (!Number.isFinite(result)) throw new Error("A selected product has an invalid quantity."); return result; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
