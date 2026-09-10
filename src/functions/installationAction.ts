import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { correlationId, publicActionFailure } from "../http/responses.js";
import { verifyActionableMessageToken, verifyInstallationToken } from "../security/tokens.js";
import { InstallationAutomationService } from "../services/installationAutomation.js";
import { hashEmail } from "../services/surveyAutomation.js";

const schema = z.object({ response: z.enum(["accepted", "declined", "reschedule_requested"]), token: z.string().min(20), reason: z.string().max(2000).optional() });
async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    const actor = await verifyActionableMessageToken(config, request.headers.get("authorization"));
    const input = schema.parse(await request.json());
    const claims = await verifyInstallationToken(config, input.token);
    const actorEmail = String(actor.preferred_username ?? actor.upn ?? actor.email ?? "");
    if (!actorEmail || hashEmail(actorEmail) !== claims.recipientHash) throw new Error("The Outlook user does not match the installation recipient.");
    const result = await new InstallationAutomationService(config).submit({ response: input.response, reason: input.reason }, claims);
    return { status: 200, headers: { "CARD-ACTION-STATUS": "Thank you. Your installation response was saved.", "Cache-Control": "no-store", "x-correlation-id": requestId }, jsonBody: { ...result, correlationId: requestId } };
  } catch (error) {
    context.error(`Installation actionable response failed. Correlation ID: ${requestId}`, error);
    return publicActionFailure(requestId, "We could not save your response. Please use the secure form link.");
  }
}
app.http("installationAction", { methods: ["POST"], authLevel: "anonymous", route: "action/installation", handler });
