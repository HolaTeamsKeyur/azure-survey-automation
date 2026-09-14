import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { extractDataverseRecordId, parseWebhookPayload, WebhookPayloadError } from "../domain/webhook.js";
import { correlationId, webhookFailure } from "../http/responses.js";
import { requireIngressKey } from "../security/tokens.js";
import { SurveyAutomationService } from "../services/surveyAutomation.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  let service: SurveyAutomationService | undefined;
  let opportunityId: string | undefined;
  try {
    const config = loadConfig();
    requireIngressKey(config, request.headers.get("x-automation-key"));
    assertEntity(request, "opportunity");
    opportunityId = extractDataverseRecordId(parseWebhookPayload(await request.text()), "opportunityId");
    service = new SurveyAutomationService(config);
    const result = await service.requestSurvey(opportunityId);
    return { status: result.reused ? 200 : 202, headers: { "x-correlation-id": requestId }, jsonBody: { ...result, correlationId: requestId } };
  } catch (error) {
    context.error(`Survey automation failed. Correlation ID: ${requestId}`, error);
    if (service && opportunityId) {
      try {
        await service.recordSurveyFailure(opportunityId, error, requestId);
      } catch (recordingError) {
        context.error(`Survey failure could not be written to the Opportunity. Correlation ID: ${requestId}`, recordingError);
      }
    }
    return webhookFailure(error, requestId);
  }
}

app.http("requestSurvey", { methods: ["POST"], authLevel: "anonymous", route: "events/opportunity-ready", handler });

function assertEntity(request: HttpRequest, expected: string): void {
  const actual = request.headers.get("x-ms-dynamics-entity-name");
  if (actual && actual.toLowerCase() !== expected) throw new WebhookPayloadError(`Unexpected Dataverse entity: ${actual}.`);
}
