import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

const valid = {
  DATAVERSE_URL: "https://example.crm.dynamics.com",
  GRAPH_SENDER_MAILBOX: "surveys@example.com",
  PUBLIC_BASE_URL: "https://example.azurestaticapps.net",
  SURVEY_TOKEN_SECRET: "12345678901234567890123456789012",
  AUTOMATION_INGRESS_KEY: "123456789012345678901234",
  ENABLE_ACTIONABLE_MESSAGES: "false",
  ENABLE_WORD_DOCUMENT: "false"
};

test("loads a safe browser-link-only configuration", () => {
  const config = loadConfig(valid);
  assert.equal(config.enableActionableMessages, false);
  assert.equal(config.enableWordDocument, false);
  assert.equal(config.sendInstallationEmail, true);
  assert.equal(config.enableAutoScheduling, false);
  assert.equal(config.requireSurveyorAuth, true);
  assert.equal(config.surveyorAccessMode, "tenant");
  assert.equal(config.dataverseUrl, valid.DATAVERSE_URL);
});

test("disables both Graph email writers for the Power Automate pilot", () => {
  const config = loadConfig({ ...valid, SEND_SURVEY_EMAIL: "false", SEND_INSTALLATION_EMAIL: "false", ENABLE_AUTO_SCHEDULING: "false" });
  assert.equal(config.sendSurveyEmail, false);
  assert.equal(config.sendInstallationEmail, false);
  assert.equal(config.enableAutoScheduling, false);
});

test("fails fast when optional features lack required dependencies", () => {
  assert.throws(() => loadConfig({ ...valid, ENABLE_WORD_DOCUMENT: "true", TEMPLATE_STORAGE_URL: "" }), /Template storage URL/);
  assert.throws(() => loadConfig({ ...valid, ENABLE_ACTIONABLE_MESSAGES: "true" }), /Actionable Messages/);
});

test("rejects inverted business hours and malformed tenant restrictions", () => {
  assert.throws(() => loadConfig({ ...valid, SURVEY_BUSINESS_START_HOUR: "17", SURVEY_BUSINESS_END_HOUR: "9" }), /Business end hour/);
  assert.throws(() => loadConfig({
    ...valid,
    ENABLE_ACTIONABLE_MESSAGES: "true",
    ACTIONABLE_APP_ID_URI: "api://auth-am-example/example",
    ACTIONABLE_ORIGINATOR_ID: "11111111-1111-4111-8111-111111111111",
    ACTIONABLE_ALLOWED_TENANTS: "not-a-guid"
  }), /Invalid allowed tenant ID/);
});
