import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { correlationId, publicFormErrorMessage } from "../http/responses.js";
import { verifyInstallationToken } from "../security/tokens.js";
import { InstallationAutomationService } from "../services/installationAutomation.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    const token = String(request.params.token ?? "");
    const claims = await verifyInstallationToken(config, token);
    const service = new InstallationAutomationService(config);
    if (request.method === "GET") {
      const session = await service.getForm(claims);
      return { status: 200, headers: headers(requestId), body: page("Confirm installation", `<h1>Confirm your installation</h1><p>${escapeHtml(session.scheduledStart)} to ${escapeHtml(session.scheduledEnd)}</p><form method="post"><label>Response<select name="response"><option value="accepted">Accept</option><option value="reschedule_requested">Request another time</option><option value="declined">Decline</option></select></label><label>Message or reason<textarea name="reason" maxlength="2000"></textarea></label><button type="submit">Submit securely</button></form>`) };
    }
    const form = await request.formData();
    const response = String(form.get("response")) as "accepted" | "declined" | "reschedule_requested";
    if (!(["accepted", "declined", "reschedule_requested"] as string[]).includes(response)) throw new Error("Invalid response.");
    const result = await service.submit({ response, reason: String(form.get("reason") ?? "") || undefined }, claims);
    return { status: 200, headers: headers(requestId), body: page("Response saved", `<h1>Thank you</h1><p>Your response was saved: ${escapeHtml(result.status)}.</p>`) };
  } catch (error) {
    context.error(`Installation form request failed. Correlation ID: ${requestId}`, error);
    return { status: 400, headers: headers(requestId), body: page("Unable to continue", `<h1>Unable to continue</h1><p>${escapeHtml(publicFormErrorMessage())}</p>`) };
  }
}
app.http("installationForm", { methods: ["GET", "POST"], authLevel: "anonymous", route: "installation/{token}", handler });
function headers(requestId: string): Record<string, string> { return { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "x-correlation-id": requestId }; }
function page(title: string, body: string): string { return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui;max-width:700px;margin:2rem auto;padding:1rem}label,textarea,select{display:block;width:100%;margin:1rem 0;padding:.5rem}button{padding:.75rem;background:#0866b5;color:#fff;border:0}</style></head><body>${body}</body></html>`; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
