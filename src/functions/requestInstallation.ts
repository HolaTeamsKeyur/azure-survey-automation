import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { extractDataverseRecordId, parseWebhookPayload, WebhookPayloadError } from "../domain/webhook.js";
import { correlationId, webhookFailure } from "../http/responses.js";
import { requireIngressKey } from "../security/tokens.js";
import { InstallationAutomationService } from "../services/installationAutomation.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    requireIngressKey(config, request.headers.get("x-automation-key"));
    const entity = request.headers.get("x-ms-dynamics-entity-name");
    if (entity && entity.toLowerCase() !== "salesorder") throw new WebhookPayloadError(`Unexpected Dataverse entity: ${entity}.`);
    const orderId = extractDataverseRecordId(parseWebhookPayload(await request.text()), "orderId");
    const result = await new InstallationAutomationService(config).request(orderId);
    return { status: result.reused ? 200 : 202, headers: { "x-correlation-id": requestId }, jsonBody: { ...result, correlationId: requestId } };
  } catch (error) {
    context.error(`Installation automation failed. Correlation ID: ${requestId}`, error);
    return webhookFailure(error, requestId);
  }
}
app.http("requestInstallation", { methods: ["POST"], authLevel: "anonymous", route: "events/installation-ready", handler });
