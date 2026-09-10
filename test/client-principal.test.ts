import assert from "node:assert/strict";
import test from "node:test";
import type { HttpRequest } from "@azure/functions";
import { loadConfig } from "../src/config.js";
import { assertSurveyorAccess, readClientPrincipal, surveyorLoginUrl } from "../src/security/clientPrincipal.js";

const config = loadConfig({ DATAVERSE_URL: "https://example.crm.dynamics.com", GRAPH_SENDER_MAILBOX: "surveys@example.com", PUBLIC_BASE_URL: "https://example.azurestaticapps.net", SURVEY_TOKEN_SECRET: "12345678901234567890123456789012", AUTOMATION_INGRESS_KEY: "123456789012345678901234", AZURE_TENANT_ID: "11111111-1111-4111-8111-111111111111" });

function requestFor(email: string, tenantId = config.azureTenantId): HttpRequest {
  const value = { identityProvider: "aad", userId: "user-1", userDetails: email, userRoles: ["anonymous", "authenticated"], claims: [{ typ: "preferred_username", val: email }, { typ: "tid", val: tenantId }] };
  return { headers: new Headers({ "x-ms-client-principal": Buffer.from(JSON.stringify(value)).toString("base64") }) } as HttpRequest;
}

test("allows only the assigned surveyor from the configured tenant", () => {
  const principal = readClientPrincipal(requestFor("surveyor@example.com"));
  assert.doesNotThrow(() => assertSurveyorAccess(config, principal, "Surveyor@example.com"));
  assert.throws(() => assertSurveyorAccess(config, principal, "other@example.com"), /different surveyor/);
  assert.throws(() => assertSurveyorAccess(config, readClientPrincipal(requestFor("surveyor@example.com", "22222222-2222-4222-8222-222222222222")), "surveyor@example.com"), /authorised.*tenant/i);
});

test("builds an Entra login wrapper for the signed form route", () => {
  const url = surveyorLoginUrl(config.publicBaseUrl, "signed.token");
  assert.match(url, /\/\.auth\/login\/aad\?post_login_redirect_uri=/);
  assert.match(decodeURIComponent(url), /\/api\/survey\/signed.token$/);
});
