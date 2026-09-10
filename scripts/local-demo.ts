import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { loadConfig } from "../src/config.js";
import type { InstallationSessionStatus, OpportunityContext, ProductOption, SurveyProductSelectionSnapshot, SurveySessionStatus } from "../src/domain/models.js";
import { assertInstallationTransition, assertTransition, validateInstallationSubmission, validateProductSelections, validateSurveySubmission } from "../src/domain/rules.js";
import { buildInstallationCard } from "../src/messages/cards.js";
import { issueInstallationToken, issueSurveyToken, verifyInstallationToken, verifySurveyToken } from "../src/security/tokens.js";
import { renderSurveyForm, renderSurveyThanks, surveyPageHeaders } from "../src/views/surveyPage.js";

const host = "127.0.0.1";
const port = Number(process.env.LOCAL_DEMO_PORT ?? 4280);
const baseUrl = `http://${host}:${port}`;
const config = loadConfig({ DATAVERSE_URL: "https://local.crm.dynamics.com", GRAPH_SENDER_MAILBOX: "brighton@access4lofts.co.uk", PUBLIC_BASE_URL: baseUrl, SURVEY_TOKEN_SECRET: "local-only-secret-never-use-in-production-2026", AUTOMATION_INGRESS_KEY: "local-only-ingress-never-production", ENABLE_ACTIONABLE_MESSAGES: "false", ENABLE_WORD_DOCUMENT: "false" });
const surveyId = "10000000-0000-4000-8000-000000000003";
const installationId = "10000000-0000-4000-8000-000000000004";
const unitId = "10000000-0000-4000-8000-000000000005";
const context: OpportunityContext = {
  opportunityId: "10000000-0000-4000-8000-000000000002", name: "Brighton Enquiry — Alex Morgan", streetName: "14 Preston Road, Brighton", propertyPostcode: "BN1 4QF",
  customer: { contactId: "10000000-0000-4000-8000-000000000001", name: "Alex Morgan", email: "alex.morgan@email.com" },
  surveyDetails: { propertyType: "Semi-detached", propertyAge: "1930s", existingHatchType: "Push-up hatch" },
  region: { id: "50000000-0000-4000-8000-000000000001", name: "Brighton Region", franchiseName: "Brighton", telephone: "01273 034001", senderMailbox: "brighton@access4lofts.co.uk", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: true }
};
const products: ProductOption[] = [
  p(1, "New uPVC hatch (straight replace)", 124.17), p(2, "New uPVC hatch (enlarge hatch size) *", 207.50, true), p(3, "Relocate hatch and fit uPVC hatch *", 210, true),
  p(4, "Adapt current hatch to drop down", 114.17), p(5, "Supply and fit wooden drop down hatch", 232.50), p(6, "Enlarge wooden hatch *", 260), p(7, "Relocate hatch and fit wooden hatch *", 299.17, true),
  p(8, "2 section aluminium ladder", 180), p(9, "3 section easy stow aluminium ladder", 252.50), p(10, "2.6m telescopic ladder", 342.50), p(11, "2.9m telescopic ladder", 367.50), p(12, "Deluxe Ladder (over 3m)", 417.50), p(13, "Eco S Line wooden ladder", 496.67),
  p(14, "Boarding on a floating floor (96 x 44mm timber)", 60, true, "sq m"), p(15, "Boarding on a Loft Leg floating floor", 63.33, true, "sq m"), p(16, "Top up insulation", 13.33, true, "sq m"), p(17, "Breathable Membrane", 12.50, true, "sq m"),
  p(18, "Loft Lids", 11.67), p(19, "Loft light - battery", 33.33), p(20, "Shelving", 46.67, false, "m"), p(21, "Balustrade", 0, false, "size dependant")
];
let state = resetState();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", baseUrl);
    if (request.method === "GET" && url.pathname === "/") return redirect(response, `/api/survey/${encodeURIComponent((await tokens()).survey)}`);
    if (request.method === "GET" && url.pathname === "/survey-form.js") return javascript(response, readFileSync(new URL("../web/survey-form.js", import.meta.url), "utf8"));
    if (request.method === "GET" && url.pathname === "/api/health") return json(response, 200, { status: "ok", service: "holateams-survey-automation" });
    if (request.method === "GET" && url.pathname === "/installation-email-preview") return html(response, 200, await installationEmailPreview());
    if (request.method === "POST" && url.pathname === "/api/local/installation-action") return await installationAction(request, response);
    if (url.pathname.startsWith("/api/survey/")) return await surveyRoute(request, response, decodeURIComponent(url.pathname.slice(12)));
    if (url.pathname.startsWith("/api/installation/")) return await installationRoute(request, response, decodeURIComponent(url.pathname.slice(18)));
    return html(response, 404, "Not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process the request.";
    return html(response, 400, `<h1>Unable to continue</h1><p>${escapeHtml(message)}</p>`);
  }
}).listen(port, host, () => {
  console.log(`Access4Lofts form: ${baseUrl}`);
  console.log(`Separate installation email preview: ${baseUrl}/installation-email-preview`);
});

async function surveyRoute(request: IncomingMessage, response: ServerResponse, token: string): Promise<void> {
  const claims = await verifySurveyToken(config, token);
  if (claims.sessionId !== surveyId || claims.tokenId !== state.surveyTokenId) throw new Error("This survey link is invalid or expired.");
  if (request.method === "GET") return htmlWithHeaders(response, 200, renderSurveyForm({ token, context, scheduledStart: "2026-09-15T10:00:00+01:00", products }), surveyPageHeaders(randomUUID()));
  if (request.method !== "POST") return methodNotAllowed(response);
  const form = await formData(request);
  const selections = products.map(product => ({ productId: product.productId, quantity: numeric(form.get(`quantity_${product.productId}`)) })).filter(item => item.quantity > 0);
  const submission = validateSurveySubmission({ sessionId: surveyId, response: "accepted", selectedProductIds: selections.map(item => item.productId), productSelections: selections, details: surveyDetails(form) });
  assertTransition(state.surveyStatus, submission.response);
  state.lines = validateProductSelections(submission.productSelections ?? [], products);
  state.surveyStatus = "accepted";
  return htmlWithHeaders(response, 200, renderSurveyThanks(state.lines.length), surveyPageHeaders(randomUUID()));
}

async function installationRoute(request: IncomingMessage, response: ServerResponse, token: string): Promise<void> {
  const claims = await verifyInstallationToken(config, token);
  if (claims.sessionId !== installationId || claims.tokenId !== state.installationTokenId) throw new Error("This installation link is invalid or expired.");
  if (request.method === "GET") return html(response, 200, `<main><h1>Confirm your installation</h1><p>22 September 2026, 08:30–15:30</p></main>`);
  return methodNotAllowed(response);
}

async function installationAction(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const form = await formData(request);
  const claims = await verifyInstallationToken(config, String(form.get("token") ?? ""));
  if (claims.sessionId !== installationId || claims.tokenId !== state.installationTokenId) throw new Error("This installation action is invalid or expired.");
  const submission = validateInstallationSubmission({ response: String(form.get("response")) as "accepted" | "declined" | "reschedule_requested", reason: optional(form.get("reason")) });
  assertInstallationTransition(state.installationStatus, submission.response);
  state.installationStatus = submission.response;
  return html(response, 200, `<main><h1>Thank you</h1><p>Your installation response has been saved: <strong>${escapeHtml(submission.response)}</strong>.</p></main>`);
}

async function installationEmailPreview(): Promise<string> {
  const token = (await tokens()).installation;
  const card = buildInstallationCard({ originatorId: "40000000-0000-4000-8000-000000000001", orderName: "ORDER-2088", start: "22 September 2026, 08:30", end: "15:30", actionUrl: `${baseUrl}/api/action/installation`, token, formUrl: `${baseUrl}/api/installation/${encodeURIComponent(token)}` });
  const buttons = (["accepted", "reschedule_requested", "declined"] as const).map(value => `<form method="post" action="/api/local/installation-action"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="hidden" name="response" value="${value}"><button>${value === "accepted" ? "Accept installation" : value === "declined" ? "Decline" : "Request another time"}</button></form>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Installation email</title><style>body{font-family:Segoe UI,Arial;background:#eef2f5;margin:0;padding:40px;color:#222}.outlook{max-width:760px;margin:auto;background:white;border:1px solid #ccd4da}.mailhead{padding:20px;border-bottom:1px solid #ddd}.body{padding:28px}.card{border:1px solid #c8d4df;border-radius:6px;padding:22px;margin-top:20px}form{display:inline-block}button{background:#0969ad;color:white;border:0;padding:10px 14px;margin:5px;cursor:pointer}details{margin-top:25px}pre{white-space:pre-wrap;background:#f4f4f4;padding:12px}</style></head><body><article class="outlook"><div class="mailhead"><strong>From:</strong> Access4Lofts Brighton &lt;brighton@access4lofts.co.uk&gt;<br><strong>To:</strong> Alex Morgan<br><strong>Subject:</strong> Confirm your Access4Lofts installation</div><div class="body"><p>Hello Alex,</p><p>Please confirm your installation appointment.</p><section class="card"><h2>Confirm your installation</h2><p><strong>ORDER-2088</strong></p><p>22 September 2026, 08:30–15:30</p>${buttons}</section><details><summary>Adaptive Card payload</summary><pre>${escapeHtml(JSON.stringify(card, null, 2))}</pre></details></div></article></body></html>`;
}

function surveyDetails(form: URLSearchParams) { const numberFields = ["ceilingHeightCm", "hatchTopWidthCm", "hatchTopLengthCm", "hatchInsideWidthCm", "hatchInsideLengthCm", "ladderClearanceWidthCm", "ladderArcClearanceCm"] as const; const textFields = ["address", "propertyType", "propertyAge", "advertisingSource", "existingHatchType", "flooringRequired", "ladderRequired", "lightRequired", "insulationRequired", "otherInformation", "quotationDate", "houseType", "roofType", "ladderArcType", "planNotes", "additionalInfo"] as const; const result: Record<string, string | number | undefined> = {}; for (const name of textFields) result[name] = optional(form.get(name)); for (const name of numberFields) result[name] = numericOptional(form.get(name)); return result; }
function p(index: number, name: string, price: number, indicative = false, unitName = "Each"): ProductOption { return { productId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`, unitId, name, price, quantity: 1, unitName, priceDisplayText: price ? `${indicative ? "From " : ""}£${price.toFixed(2)}${unitName !== "Each" ? ` per ${unitName}` : ""}` : "Size dependant", priceIsIndicative: indicative, selectedByDefault: false, sortOrder: index }; }
function resetState() { return { surveyStatus: "sent" as SurveySessionStatus, installationStatus: "sent" as InstallationSessionStatus, surveyTokenId: randomUUID(), installationTokenId: randomUUID(), lines: [] as SurveyProductSelectionSnapshot[] }; }
async function tokens() { const recipientHash = createHash("sha256").update(context.customer.email).digest("hex"); return { survey: await issueSurveyToken(config, { sessionId: surveyId, tokenId: state.surveyTokenId, recipientHash }), installation: await issueInstallationToken(config, { sessionId: installationId, tokenId: state.installationTokenId, recipientHash }) }; }
async function formData(request: IncomingMessage): Promise<URLSearchParams> { const chunks: Buffer[] = []; let size = 0; for await (const chunk of request) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length; if (size > 128 * 1024) throw new Error("The form is too large."); chunks.push(bytes); } return new URLSearchParams(Buffer.concat(chunks).toString("utf8")); }
function numeric(value: string | null): number { const text = value?.trim(); if (!text) return 0; const result = Number(text); if (!Number.isFinite(result)) throw new Error("A numeric value is invalid."); return result; }
function numericOptional(value: string | null): number | undefined { const text = value?.trim(); return text ? numeric(text) : undefined; }
function optional(value: string | null): string | undefined { const result = value?.trim(); return result || undefined; }
function redirect(response: ServerResponse, location: string): void { response.writeHead(302, { Location: location, "Cache-Control": "no-store" }); response.end(); }
function javascript(response: ServerResponse, body: string): void { response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" }); response.end(body); }
function json(response: ServerResponse, status: number, value: unknown): void { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(value)); }
function html(response: ServerResponse, status: number, body: string): void { htmlWithHeaders(response, status, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial;max-width:700px;margin:10vh auto;padding:24px}h1{color:#0969ad}</style></head><body>${body}</body></html>`, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); }
function htmlWithHeaders(response: ServerResponse, status: number, body: string, headers: Record<string, string>): void { response.writeHead(status, headers); response.end(body); }
function methodNotAllowed(response: ServerResponse): void { response.writeHead(405); response.end(); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
