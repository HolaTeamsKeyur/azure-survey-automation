import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { loadConfig } from "../src/config.js";
import type { OpportunityContext, ProductOption, SurveyProductSelectionSnapshot, SurveySessionStatus, InstallationSessionStatus } from "../src/domain/models.js";
import { assertInstallationTransition, assertTransition, validateInstallationSubmission, validateProductSelections, validateSurveySubmission } from "../src/domain/rules.js";
import { buildSurveyCard, buildInstallationCard } from "../src/messages/cards.js";
import { buildSurveyDocumentModel, renderSurveyDocumentTemplate } from "../src/infrastructure/documents.js";
import { issueInstallationToken, issueSurveyToken, verifyInstallationToken, verifySurveyToken } from "../src/security/tokens.js";

const host = "127.0.0.1";
const port = Number(process.env.LOCAL_DEMO_PORT ?? 4280);
const baseUrl = `http://${host}:${port}`;
const config = loadConfig({
  DATAVERSE_URL: "https://local-demo.crm.dynamics.com",
  GRAPH_SENDER_MAILBOX: "surveys@example.test",
  PUBLIC_BASE_URL: baseUrl,
  SURVEY_TOKEN_SECRET: "local-demo-only-secret-change-before-production-2026",
  AUTOMATION_INGRESS_KEY: "local-demo-ingress-key-never-use-prod",
  ENABLE_ACTIONABLE_MESSAGES: "false",
  ENABLE_WORD_DOCUMENT: "false"
});

const ids = {
  customer: "10000000-0000-4000-8000-000000000001",
  opportunity: "10000000-0000-4000-8000-000000000002",
  survey: "10000000-0000-4000-8000-000000000003",
  installation: "10000000-0000-4000-8000-000000000004",
  unit: "10000000-0000-4000-8000-000000000005"
};

const catalog: Record<string, { name: string; code: string; telephone: string; products: ProductOption[] }> = {
  midlands: {
    name: "West Midlands", code: "WM", telephone: "0121 555 0142",
    products: [
      product("20000000-0000-4000-8000-000000000001", "Loft hatch enlargement", "Enlarge and finish the existing opening", 395, "Each", true, 10),
      product("20000000-0000-4000-8000-000000000002", "Timber loft ladder", "Easy-stow three-section ladder", 285, "Each", true, 20),
      product("20000000-0000-4000-8000-000000000003", "Loft boarding", "Raised boarding above insulation", 72.5, "m²", false, 30),
      product("20000000-0000-4000-8000-000000000004", "LED loft light", "Fitted LED batten and switch", 145, "Each", false, 40)
    ]
  },
  northwest: {
    name: "North West", code: "NW", telephone: "0161 555 0199",
    products: [
      product("30000000-0000-4000-8000-000000000001", "Insulated loft hatch", "Draft-sealed insulated replacement hatch", 425, "Each", true, 10),
      product("30000000-0000-4000-8000-000000000002", "Aluminium loft ladder", "Lightweight three-section ladder", 260, "Each", true, 20),
      product("30000000-0000-4000-8000-000000000003", "Loft boarding", "Raised boarding above insulation", 69.95, "m²", false, 30),
      product("30000000-0000-4000-8000-000000000004", "Loft insulation top-up", "Additional mineral wool insulation", 18.5, "m²", false, 40)
    ]
  }
};

let state = freshState("midlands");

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", baseUrl);
    if (request.method === "GET" && url.pathname === "/") {
      const requestedRegion = url.searchParams.get("region");
      if (requestedRegion && catalog[requestedRegion] && requestedRegion !== state.regionKey) state = freshState(requestedRegion);
      return html(response, 200, await dashboard());
    }
    if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { status: "ok", mode: "local-mock", region: state.regionKey });
    if (request.method === "POST" && url.pathname === "/api/local/reset") { state = freshState(state.regionKey); return redirect(response, "/"); }
    if (request.method === "GET" && url.pathname === "/email-preview") return html(response, 200, await emailPreview());
    if (request.method === "GET" && url.pathname === "/api/local/survey-card") return json(response, 200, await surveyCard());
    if (request.method === "GET" && url.pathname === "/api/local/installation-card") return json(response, 200, await installationCard());
    if (request.method === "GET" && url.pathname === "/api/local/survey.docx") return word(response);
    if (url.pathname.startsWith("/api/survey/")) return await surveyRoute(request, response, decodeURIComponent(url.pathname.slice(12)));
    if (url.pathname.startsWith("/api/installation/")) return await installationRoute(request, response, decodeURIComponent(url.pathname.slice(18)));
    return html(response, 404, page("Not found", "<h1>Not found</h1><p><a href='/'>Return to demo dashboard</a></p>"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected local demo error.";
    return html(response, 400, page("Request failed", `<h1>Request failed</h1><p class="error">${escapeHtml(message)}</p><p><a href='/'>Return to dashboard</a></p>`));
  }
});

server.listen(port, host, () => {
  console.log(`HolaTeams local demo is ready: ${baseUrl}`);
  console.log("Mock mode: no Dataverse writes and no email is sent.");
});

async function dashboard(): Promise<string> {
  const tokens = await demoTokens();
  const region = catalog[state.regionKey];
  const selectedTotal = state.selections.reduce((sum, item) => sum + item.lineNet, 0);
  const regionOptions = Object.entries(catalog).map(([key, item]) => `<a class="pill ${key === state.regionKey ? "active" : ""}" href="/?region=${key}">${escapeHtml(item.name)}</a>`).join("");
  const productRows = region.products.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.unitName ?? "")}</td><td>${escapeHtml(item.priceDisplayText ?? "")}</td></tr>`).join("");
  return page("Local survey automation demo", `
    <p class="banner"><strong>LOCAL MOCK MODE</strong> — no Microsoft login, Dataverse, Azure, or email delivery is used.</p>
    <h1>Survey automation control room</h1><p>Sample record: <strong>OPP-1042 — Taylor loft conversion</strong></p>
    <section><h2>1. Choose regional price list</h2><div>${regionOptions}</div><p>${escapeHtml(region.name)} · ${escapeHtml(region.telephone)}</p><table><thead><tr><th>Product</th><th>Unit</th><th>Regional price</th></tr></thead><tbody>${productRows}</tbody></table></section>
    <section><h2>2. Open customer experience</h2><div class="actions"><a class="button" href="/email-preview">Outlook email + cards preview</a><a class="button" href="/api/survey/${encodeURIComponent(tokens.survey)}">Open signed survey form</a><a class="button" href="/api/installation/${encodeURIComponent(tokens.installation)}">Open installation form</a><a class="button secondary" href="/api/local/survey.docx">Download dynamic Word file</a></div></section>
    <section><h2>3. Mock Dataverse state</h2><dl><dt>Survey status</dt><dd>${state.surveyStatus}</dd><dt>Installation status</dt><dd>${state.installationStatus}</dd><dt>Selected rows</dt><dd>${state.selections.length}</dd><dt>Selected subtotal</dt><dd>GBP ${selectedTotal.toFixed(2)}</dd><dt>Last reason</dt><dd>${escapeHtml(state.reason || "—")}</dd></dl><form method="post" action="/api/local/reset"><button class="secondary" type="submit">Reset sample records</button></form></section>
    <section><h2>What becomes real after admin access?</h2><p>The mock repository is replaced by Dataverse, the previews are sent through Microsoft Graph, and Azure supplies the public HTTPS URLs. The form, tokens, cards, validation, document template, and business flow remain the same.</p></section>`);
}

async function surveyRoute(request: IncomingMessage, response: ServerResponse, token: string): Promise<void> {
  const claims = await verifySurveyToken(config, token);
  if (claims.sessionId !== ids.survey || claims.tokenId !== state.surveyTokenId) throw new Error("This survey link is invalid or was reset.");
  if (request.method === "GET") return html(response, 200, surveyForm(token));
  if (request.method !== "POST") return methodNotAllowed(response);
  const form = await formData(request);
  const selectedProductIds = form.getAll("products");
  const submission = validateSurveySubmission({ sessionId: ids.survey, response: String(form.get("response") ?? "") as "accepted" | "declined" | "reschedule_requested", selectedProductIds, productSelections: selectedProductIds.map(productId => ({ productId, quantity: Number(form.get(`quantity_${productId}`)), note: optional(form.get(`note_${productId}`)) })), reason: optional(form.get("reason")), feedbackScore: numberOptional(form.get("feedbackScore")), feedbackComments: optional(form.get("feedbackComments")) });
  assertTransition(state.surveyStatus, submission.response);
  state.selections = validateProductSelections(submission.productSelections ?? [], currentProducts());
  state.surveyStatus = submission.response;
  state.reason = submission.reason ?? "";
  return html(response, 200, page("Survey response saved", `<h1>Thank you, Jamie</h1><p>The mock Dataverse survey status is now <strong>${escapeHtml(state.surveyStatus)}</strong>.</p><p>${state.selections.length} product row(s) and their quantities were saved.</p><p><a class="button" href="/">See updated dashboard</a></p>`));
}

async function installationRoute(request: IncomingMessage, response: ServerResponse, token: string): Promise<void> {
  const claims = await verifyInstallationToken(config, token);
  if (claims.sessionId !== ids.installation || claims.tokenId !== state.installationTokenId) throw new Error("This installation link is invalid or was reset.");
  if (request.method === "GET") return html(response, 200, installationForm(token));
  if (request.method !== "POST") return methodNotAllowed(response);
  const form = await formData(request);
  const submission = validateInstallationSubmission({ response: String(form.get("response") ?? "") as "accepted" | "declined" | "reschedule_requested", reason: optional(form.get("reason")) });
  assertInstallationTransition(state.installationStatus, submission.response);
  state.installationStatus = submission.response;
  state.reason = submission.reason ?? state.reason;
  return html(response, 200, page("Installation response saved", `<h1>Installation response saved</h1><p>The mock Dataverse installation status is now <strong>${escapeHtml(state.installationStatus)}</strong>.</p><p><a class="button" href="/">See updated dashboard</a></p>`));
}

function surveyForm(token: string): string {
  const rows = currentProducts().map(product => `<div class="product"><label class="pick"><input type="checkbox" name="products" value="${product.productId}" ${product.selectedByDefault ? "checked" : ""}><span><strong>${escapeHtml(product.name)}</strong><br><small>${escapeHtml(product.description ?? "")}</small><br><b>${escapeHtml(product.priceDisplayText ?? "")}</b></span></label><label>Quantity<input type="number" min="0.001" max="100000" step="0.001" name="quantity_${product.productId}" value="${product.quantity}"></label><label>Product note<input type="text" maxlength="500" name="note_${product.productId}"></label></div>`).join("");
  return page("Customer survey", `<p class="banner">SIGNED LOCAL TEST FORM</p><h1>Your Access4Lofts survey</h1><p>Proposed time: <strong>15 September 2026, 10:00–11:00</strong></p><form method="post" action="/api/survey/${encodeURIComponent(token)}"><fieldset><legend>Products to discuss — ${escapeHtml(catalog[state.regionKey].name)}</legend>${rows}</fieldset><label>Response<select name="response"><option value="accepted">Accept and submit</option><option value="reschedule_requested">Request another time</option><option value="declined">Decline</option></select></label><label>Message or reason<textarea name="reason" maxlength="2000"></textarea></label><label>Experience score (1–5)<input type="number" name="feedbackScore" min="1" max="5" step="1"></label><label>Feedback<textarea name="feedbackComments" maxlength="2000"></textarea></label><button type="submit">Submit securely</button></form>`);
}

function installationForm(token: string): string {
  return page("Confirm installation", `<p class="banner">SIGNED LOCAL TEST FORM</p><h1>Confirm your installation</h1><p><strong>ORDER-2088</strong>: 22 September 2026, 08:30–15:30</p><form method="post" action="/api/installation/${encodeURIComponent(token)}"><label>Response<select name="response"><option value="accepted">Accept</option><option value="reschedule_requested">Request another time</option><option value="declined">Decline</option></select></label><label>Message or reason<textarea name="reason" maxlength="2000"></textarea></label><button type="submit">Submit securely</button></form>`);
}

async function emailPreview(): Promise<string> {
  const tokens = await demoTokens(); const survey = await surveyCard(); const installation = await installationCard();
  return page("Outlook actionable email preview", `<p class="banner">OUTLOOK-STYLE PREVIEW — nothing has been sent</p><h1>Customer messages</h1><div class="mail"><div class="mailhead"><strong>Access4Lofts ${escapeHtml(catalog[state.regionKey].name)}</strong> &lt;surveys@example.test&gt;<br><small>To: Jamie Taylor &lt;jamie.taylor@example.test&gt;</small></div><h2>Your loft survey</h2><p>Hello Jamie, please confirm the proposed appointment and select products to discuss.</p><div class="card"><h3>Adaptive Card actions</h3><p>15 September 2026, 10:00–11:00</p><a class="button" href="/api/survey/${encodeURIComponent(tokens.survey)}">Open full survey form</a><details><summary>View Adaptive Card JSON</summary><pre>${escapeHtml(JSON.stringify(survey, null, 2))}</pre></details></div></div><div class="mail"><h2>Installation confirmation</h2><div class="card"><p>22 September 2026, 08:30–15:30</p><a class="button" href="/api/installation/${encodeURIComponent(tokens.installation)}">Open installation form</a><details><summary>View Adaptive Card JSON</summary><pre>${escapeHtml(JSON.stringify(installation, null, 2))}</pre></details></div></div><p><a href="/">Return to dashboard</a></p>`);
}

async function surveyCard(): Promise<object> { const token = (await demoTokens()).survey; return buildSurveyCard({ originatorId: "40000000-0000-4000-8000-000000000001", context: opportunity(), products: currentProducts(), scheduledStart: "2026-09-15T10:00:00+01:00", scheduledEnd: "2026-09-15T11:00:00+01:00", actionUrl: `${baseUrl}/api/local/action/survey`, token, formUrl: `${baseUrl}/api/survey/${encodeURIComponent(token)}` }); }
async function installationCard(): Promise<object> { const token = (await demoTokens()).installation; return buildInstallationCard({ originatorId: "40000000-0000-4000-8000-000000000001", orderName: "ORDER-2088", start: "2026-09-22T08:30:00+01:00", end: "2026-09-22T15:30:00+01:00", actionUrl: `${baseUrl}/api/local/action/installation`, token, formUrl: `${baseUrl}/api/installation/${encodeURIComponent(token)}` }); }

function word(response: ServerResponse): void {
  const template = readFileSync(new URL("../templates/survey-template.baseline.docx", import.meta.url));
  const document = renderSurveyDocumentTemplate(template, buildSurveyDocumentModel(opportunity(), currentProducts(), "15 September 2026, 10:00", state.selections));
  response.writeHead(200, { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="survey-${state.regionKey}.docx"`, "Content-Length": document.length, "Cache-Control": "no-store" }); response.end(document);
}

function opportunity(): OpportunityContext {
  const region = catalog[state.regionKey];
  return { opportunityId: ids.opportunity, name: "OPP-1042 — Taylor loft conversion", propertyPostcode: "B1 1AA", streetName: "10 Sample Street", customer: { contactId: ids.customer, name: "Jamie Taylor", email: "jamie.taylor@example.test", mobile: "07700 900123" }, region: { id: `50000000-0000-4000-8000-00000000000${state.regionKey === "midlands" ? "1" : "2"}`, name: region.name, code: region.code, telephone: region.telephone, senderMailbox: "surveys@example.test", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: true } };
}

function currentProducts(): ProductOption[] { return catalog[state.regionKey].products; }
function product(productId: string, name: string, description: string, price: number, unitName: string, selectedByDefault: boolean, sortOrder: number): ProductOption { return { productId, name, description, price, unitId: ids.unit, unitName, quantity: 1, priceDisplayText: `GBP ${price.toFixed(2)} / ${unitName}`, selectedByDefault, sortOrder }; }
function freshState(regionKey: string) { return { regionKey, surveyStatus: "sent" as SurveySessionStatus, installationStatus: "sent" as InstallationSessionStatus, surveyTokenId: randomUUID(), installationTokenId: randomUUID(), selections: [] as SurveyProductSelectionSnapshot[], reason: "" }; }
async function demoTokens() { const recipientHash = createHash("sha256").update("jamie.taylor@example.test").digest("hex"); return { survey: await issueSurveyToken(config, { sessionId: ids.survey, tokenId: state.surveyTokenId, recipientHash }), installation: await issueInstallationToken(config, { sessionId: ids.installation, tokenId: state.installationTokenId, recipientHash }) }; }
async function formData(request: IncomingMessage): Promise<URLSearchParams> { const chunks: Buffer[] = []; let length = 0; for await (const chunk of request) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); length += bytes.length; if (length > 64 * 1024) throw new Error("Form submission is too large."); chunks.push(bytes); } return new URLSearchParams(Buffer.concat(chunks).toString("utf8")); }
function optional(value: string | null): string | undefined { const result = value?.trim(); return result || undefined; }
function numberOptional(value: string | null): number | undefined { if (!value?.trim()) return undefined; const number = Number(value); return Number.isFinite(number) ? number : undefined; }
function html(response: ServerResponse, status: number, body: string): void { response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); response.end(body); }
function json(response: ServerResponse, status: number, body: unknown): void { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(body, null, 2)); }
function redirect(response: ServerResponse, location: string): void { response.writeHead(303, { Location: location }); response.end(); }
function methodNotAllowed(response: ServerResponse): void { response.writeHead(405, { Allow: "GET, POST" }); response.end(); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
function page(title: string, body: string): string { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{font-family:Segoe UI,system-ui,sans-serif;color:#17202a;background:#f4f7fa}body{max-width:980px;margin:0 auto;padding:28px}h1{color:#073b66}section,.mail{background:white;padding:22px;margin:18px 0;border-radius:10px;box-shadow:0 2px 12px #102a4318}.banner{padding:12px;background:#fff3cd;border-left:5px solid #e0a800}.button,button{display:inline-block;background:#0866b5;color:white!important;border:0;padding:11px 16px;border-radius:5px;text-decoration:none;cursor:pointer;margin:4px}.secondary{background:#52616b}.pill{display:inline-block;padding:8px 12px;border:1px solid #0866b5;border-radius:20px;margin:4px;text-decoration:none}.pill.active{background:#0866b5;color:white}.actions{display:flex;flex-wrap:wrap;gap:8px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px;border-bottom:1px solid #ddd}dt{font-weight:700;float:left;clear:left;width:190px}dd{margin-left:200px;padding-bottom:8px}.product{padding:14px;margin:10px 0;background:#f5f8fb;border:1px solid #d8e2ea;border-radius:6px}.pick{display:flex;gap:10px}label{display:block;margin:12px 0}input[type=number],input[type=text],textarea,select{display:block;width:100%;max-width:560px;padding:9px;margin-top:5px;box-sizing:border-box}fieldset{border:1px solid #b9c8d3}.mailhead{border-bottom:1px solid #ddd;padding-bottom:12px}.card{border:1px solid #c8d6e0;border-radius:8px;padding:18px;background:#fafcfd}pre{white-space:pre-wrap;word-break:break-word;background:#14212b;color:#d8f3dc;padding:14px;max-height:480px;overflow:auto}.error{color:#a61b1b}@media(max-width:600px){body{padding:12px}dt{float:none;width:auto}dd{margin-left:0}}</style></head><body>${body}</body></html>`; }
