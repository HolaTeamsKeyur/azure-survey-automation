import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { extractDataverseRecordId, parseWebhookPayload, WebhookPayloadError } from "../domain/webhook.js";
import { correlationId, webhookFailure } from "../http/responses.js";
import { requireIngressKey } from "../security/tokens.js";
import { SurveyAutomationService } from "../services/surveyAutomation.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    requireIngressKey(config, request.headers.get("x-automation-key"));
    assertEntity(request, "opportunity");
    const opportunityId = extractDataverseRecordId(parseWebhookPayload(await request.text()), "opportunityId");
    const result = await new SurveyAutomationService(config).requestSurvey(opportunityId);
    return { status: result.reused ? 200 : 202, headers: { "x-correlation-id": requestId }, jsonBody: { ...result, correlationId: requestId } };
  } catch (error) {
    context.error(`Survey automation failed. Correlation ID: ${requestId}`, error);
    return webhookFailure(error, requestId);
  }
}

app.http("requestSurvey", { methods: ["POST"], authLevel: "anonymous", route: "events/opportunity-ready", handler });

function assertEntity(request: HttpRequest, expected: string): void {
  const actual = request.headers.get("x-ms-dynamics-entity-name");
  if (actual && actual.toLowerCase() !== expected) throw new WebhookPayloadError(`Unexpected Dataverse entity: ${actual}.`);
}
