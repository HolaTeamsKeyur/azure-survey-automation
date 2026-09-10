import { randomUUID } from "node:crypto";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { IngressAuthenticationError } from "../security/tokens.js";
import { WebhookPayloadError } from "../domain/webhook.js";

export function correlationId(request: HttpRequest): string {
  const supplied = request.headers.get("x-correlation-id")?.trim();
  return supplied && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied) ? supplied : randomUUID();
}

export function webhookFailure(error: unknown, id: string): HttpResponseInit {
  const status = error instanceof IngressAuthenticationError
    ? 401
    : error instanceof WebhookPayloadError || error instanceof SyntaxError
      ? 400
      : 503;
  const message = status === 401
    ? "Authentication failed."
    : status === 400
      ? "The webhook payload is invalid."
      : "Automation processing temporarily failed.";
  return {
    status,
    headers: { "Cache-Control": "no-store", "x-correlation-id": id },
    jsonBody: { error: message, correlationId: id }
  };
}

export function publicActionFailure(id: string, cardStatus: string): HttpResponseInit {
  return {
    status: 400,
    headers: {
      "CARD-ACTION-STATUS": cardStatus,
      "Cache-Control": "no-store",
      "x-correlation-id": id
    },
    jsonBody: { error: "The response could not be saved. Use the secure form link.", correlationId: id }
  };
}

export function publicFormErrorMessage(): string {
  return "This link is invalid or expired, or the response could not be saved. Please contact your local Access4Lofts team.";
}
