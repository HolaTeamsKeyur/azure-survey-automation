import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { correlationId, publicActionFailure } from "../http/responses.js";
import { verifyActionableMessageToken, verifySurveyToken } from "../security/tokens.js";
import { hashEmail, SurveyAutomationService } from "../services/surveyAutomation.js";

const bodySchema = z.object({
  response: z.enum(["accepted", "declined", "reschedule_requested"]),
  token: z.string().min(20),
  selectedProducts: z.string().optional(),
  reason: z.string().max(2000).optional()
});

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    const actionClaims = await verifyActionableMessageToken(config, request.headers.get("authorization"));
    const body = bodySchema.parse(await request.json());
    const tokenClaims = await verifySurveyToken(config, body.token);
    const actorEmail = String(actionClaims.preferred_username ?? actionClaims.upn ?? actionClaims.email ?? "");
    if (!actorEmail || hashEmail(actorEmail) !== tokenClaims.recipientHash) throw new Error("The Outlook user does not match the survey recipient.");
    const service = new SurveyAutomationService(config);
    const result = await service.submitSurvey({
      sessionId: tokenClaims.sessionId,
      response: body.response,
      selectedProductIds: service.parseProductSelection(body.selectedProducts),
      reason: body.reason
    }, tokenClaims);
    return {
      status: 200,
      headers: { "CARD-ACTION-STATUS": "Thank you. Your response and product choices were saved.", "Cache-Control": "no-store", "x-correlation-id": requestId },
      jsonBody: { ...result, correlationId: requestId }
    };
  } catch (error) {
    context.error(`Survey actionable response failed. Correlation ID: ${requestId}`, error);
    return publicActionFailure(requestId, "We could not save your response. Please use the secure form link.");
  }
}

app.http("surveyAction", { methods: ["POST"], authLevel: "anonymous", route: "action/survey", handler });
