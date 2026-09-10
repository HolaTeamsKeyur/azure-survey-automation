import assert from "node:assert/strict";
import test from "node:test";
import { WebhookPayloadError } from "../src/domain/webhook.js";
import { publicActionFailure, publicFormErrorMessage, webhookFailure } from "../src/http/responses.js";
import { IngressAuthenticationError } from "../src/security/tokens.js";

const correlation = "test-correlation-123";

test("webhook failures distinguish authentication, bad payload and retryable processing", () => {
  assert.equal(webhookFailure(new IngressAuthenticationError("secret"), correlation).status, 401);
  assert.equal(webhookFailure(new WebhookPayloadError("details"), correlation).status, 400);
  assert.equal(webhookFailure(new Error("Dataverse returned sensitive details"), correlation).status, 503);
  assert.doesNotMatch(JSON.stringify(webhookFailure(new Error("Dataverse returned sensitive details"), correlation).jsonBody), /sensitive details/);
});

test("public response errors are redacted and carry a correlation ID", () => {
  const failure = publicActionFailure(correlation, "Use the browser form.");
  assert.equal(failure.status, 400);
  assert.equal((failure.headers as Record<string, string>)["x-correlation-id"], correlation);
  assert.match(publicFormErrorMessage(), /invalid or expired/);
});
