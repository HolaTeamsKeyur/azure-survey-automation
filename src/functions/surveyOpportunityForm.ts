import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { normalizeGuid } from "../domain/rules.js";
import { correlationId, publicFormErrorMessage } from "../http/responses.js";
import { assertSurveyorAccess, readClientPrincipal, SurveyorAccessError, surveyorOpportunityLoginUrl } from "../security/clientPrincipal.js";
import { SurveyAutomationService } from "../services/surveyAutomation.js";
import { renderSurveyForm, renderSurveyThanks, surveyPageHeaders } from "../views/surveyPage.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    if (!config.requireSurveyorAuth) throw new SurveyorAccessError("The permanent survey link requires Microsoft Entra sign-in.");
    const opportunityId = normalizeGuid(String(request.params.opportunityId ?? ""));
    const principal = readClientPrincipal(request);
    if (!principal) {
      return {
        status: 302,
        headers: {
          "Location": surveyorOpportunityLoginUrl(config.publicBaseUrl, opportunityId),
          "Cache-Control": "no-store"
        }
      };
    }

    const service = new SurveyAutomationService(config);
    const model = await service.getSurveyFormByOpportunityId(opportunityId);
    assertSurveyorAccess(config, principal, model.session.recipientEmail);
    if (["accepted", "declined", "reschedule_requested"].includes(model.session.status)) {
      return {
        status: 200,
        headers: surveyPageHeaders(requestId),
        body: renderSurveyThanks(model.session.selectionSnapshot.length)
      };
    }
    if (model.session.status === "expired") {
      return { status: 410, headers: surveyPageHeaders(requestId), body: errorPage("This survey has been closed. Please ask the office to reopen it.") };
    }
    if (new Date(model.session.expiresAt) <= new Date()) {
      await service.renewOpenSurveySession(model.session.id);
    }
    return {
      status: 200,
      headers: surveyPageHeaders(requestId),
      body: renderSurveyForm({
        token: model.token,
        draftId: model.session.tokenId,
        context: model.context,
        scheduledStart: model.session.scheduledStart,
        products: model.products,
        layout: model.layout,
        enableNewProductRequests: config.enableNewProductRequests
      })
    };
  } catch (error) {
    context.error(`Permanent survey form request failed. Correlation ID: ${requestId}`, error);
    if (error instanceof SurveyorAccessError) {
      return { status: 403, headers: surveyPageHeaders(requestId), body: accessDeniedPage(error.message) };
    }
    return { status: 400, headers: surveyPageHeaders(requestId), body: errorPage(publicFormErrorMessage()) };
  }
}

app.http("surveyOpportunityForm", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "survey/opportunity/{opportunityId}",
  handler
});

function errorPage(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unable to continue</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:10vh auto;padding:2rem}h1{color:#0969ad}</style></head><body><h1>Unable to continue</h1><p>${escapeHtml(message)}</p></body></html>`;
}
function accessDeniedPage(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access denied</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:10vh auto;padding:2rem}h1,a{color:#0969ad}</style></head><body><h1>Access denied</h1><p>${escapeHtml(message)}</p><p><a href="/.auth/logout?post_logout_redirect_uri=/">Sign out and use another account</a></p></body></html>`;
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
