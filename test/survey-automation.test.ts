import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import type { OpportunityContext, SurveySession } from "../src/domain/models.js";
import type { DataverseClient } from "../src/infrastructure/dataverse.js";
import type { GraphClient } from "../src/infrastructure/graph.js";
import { hashEmail, SurveyAutomationService } from "../src/services/surveyAutomation.js";
import { verifySurveyToken } from "../src/security/tokens.js";

const product = { productId: "44444444-4444-4444-8444-444444444444", unitId: "55555555-5555-4555-8555-555555555555", name: "Boarding", quantity: 1, price: 60, selectedByDefault: false, sortOrder: 1 };
const opportunity: OpportunityContext = {
  opportunityId: "11111111-1111-4111-8111-111111111111", name: "Enquiry 100", priceListId: "22222222-2222-4222-8222-222222222222", surveyorUserId: "33333333-3333-4333-8333-333333333333",
  customer: { contactId: "66666666-6666-4666-8666-666666666666", name: "Customer", email: "customer@example.test" },
  region: { id: "77777777-7777-4777-8777-777777777777", name: "Brighton", senderMailbox: "office@example.test", surveyorMailbox: "surveyor@example.test", surveyorName: "Alex Surveyor", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: false }
};
const session: SurveySession = { id: opportunity.opportunityId, opportunityId: opportunity.opportunityId, recipientEmail: "surveyor@example.test", regionId: opportunity.region.id, scheduledStart: "2026-09-15T09:00:00Z", scheduledEnd: "2026-09-15T10:00:00Z", expiresAt: "2099-01-01T00:00:00Z", status: "sent", productsSnapshot: [product], selectionSnapshot: [], tokenId: "token-id", version: 1 };

function config(extra: Record<string, string> = {}) { return loadConfig({ DATAVERSE_URL: "https://example.crm.dynamics.com", GRAPH_SENDER_MAILBOX: "office@example.test", PUBLIC_BASE_URL: "https://example.azurestaticapps.net", SURVEY_TOKEN_SECRET: "12345678901234567890123456789012", AUTOMATION_INGRESS_KEY: "123456789012345678901234", SEND_SURVEY_EMAIL: "false", ...extra }); }

test("reused survey links remain addressed to the assigned surveyor", async () => {
  const dataverse = { getOpportunityContext: async () => opportunity, findOpenSession: async () => session } as unknown as DataverseClient;
  const result = await new SurveyAutomationService(config(), dataverse, {} as GraphClient).requestSurvey(opportunity.opportunityId);
  assert.equal(result.recipientEmail, "surveyor@example.test");
  assert.equal(result.recipientName, "Alex Surveyor");
  assert.equal(result.formUrl, `https://example.azurestaticapps.net/api/survey/opportunity/${opportunity.opportunityId}`);
  assert.doesNotMatch(result.formUrl, /signed|token-id/);
});

test("the permanent Opportunity route can mint a fresh internal submission token", async () => {
  let renewal: Record<string, unknown> = {};
  const dataverse = {
    getSession: async () => session,
    getOpportunityContext: async () => opportunity,
    updateSession: async (_id: string, patch: Record<string, unknown>) => { renewal = patch; }
  } as unknown as DataverseClient;
  const appConfig = config();
  const service = new SurveyAutomationService(appConfig, dataverse, {} as GraphClient);
  const model = await service.getSurveyFormByOpportunityId(opportunity.opportunityId);
  const claims = await verifySurveyToken(appConfig, model.token);
  assert.equal(claims.sessionId, session.id);
  assert.equal(claims.tokenId, session.tokenId);
  await service.renewOpenSurveySession(session.id);
  assert.ok(new Date(String(renewal.ht_surveyexpiresat)) > new Date());
});

test("a non-catalogue request blocks quote creation until approval", async () => {
  let quoteCreated = false;
  let requestsCreated = 0;
  let reviewStatus = "";
  let opportunityProductsCleared = false;
  const dataverse = {
    getSession: async () => session,
    getOpportunityContext: async () => opportunity,
    applyOpportunityPriceList: async () => "88888888-8888-4888-8888-888888888888",
    clearOpportunityProducts: async () => { opportunityProductsCleared = true; },
    createNewProductRequests: async (_opportunityId: string, _surveyorId: string, _currencyId: string, requests: unknown[]) => { requestsCreated = requests.length; },
    generateQuoteFromOpportunity: async () => { quoteCreated = true; return { quoteId: "99999999-9999-4999-8999-999999999999", reused: false }; },
    updateSession: async (_id: string, patch: Record<string, unknown>) => { reviewStatus = String(patch.ht_surveyproductreviewstatuskey); }
  } as unknown as DataverseClient;
  const service = new SurveyAutomationService(config({ ENABLE_NEW_PRODUCT_REQUESTS: "true", CREATE_QUOTE_ON_SUBMIT: "true" }), dataverse, {} as GraphClient);
  const result = await service.submitSurvey({ sessionId: session.id, response: "accepted", selectedProductIds: [product.productId], productSelections: [{ productId: product.productId, quantity: 2 }], newProductRequests: [{ name: "Special trim", quantity: 1 }] }, { sessionId: session.id, tokenId: session.tokenId, recipientHash: hashEmail(session.recipientEmail) });
  assert.equal(requestsCreated, 1);
  assert.equal(quoteCreated, false);
  assert.equal(opportunityProductsCleared, true);
  assert.equal(reviewStatus, "pending_approval");
  assert.equal(result.requestedProductCount, 1);
  assert.equal(result.quoteId, undefined);
});

test("submission clears Opportunity Products and sends selections only to the Quote", async () => {
  let opportunityProductsCleared = false;
  let quoteSelection: unknown;
  let savedPatch: Record<string, unknown> = {};
  let finalExpectedVersion: number | undefined;
  const dataverse = {
    getSession: async () => session,
    getOpportunityContext: async () => opportunity,
    applyOpportunityPriceList: async () => "88888888-8888-4888-8888-888888888888",
    clearOpportunityProducts: async () => { opportunityProductsCleared = true; },
    generateQuoteFromOpportunity: async (_opportunityId: string, selected: unknown) => { quoteSelection = selected; return { quoteId: "99999999-9999-4999-8999-999999999999", reused: false }; },
    updateSession: async (_id: string, patch: Record<string, unknown>, expectedVersion?: number) => {
      savedPatch = patch;
      finalExpectedVersion = expectedVersion;
    }
  } as unknown as DataverseClient;
  const service = new SurveyAutomationService(config({ CREATE_QUOTE_ON_SUBMIT: "true" }), dataverse, {} as GraphClient);
  const result = await service.submitSurvey(
    { sessionId: session.id, response: "accepted", selectedProductIds: [product.productId], productSelections: [{ productId: product.productId, quantity: 2 }], details: { propertyType: "Semi-Detached", flooringRequired: "No", lightRequired: "Already Installed" } },
    { sessionId: session.id, tokenId: session.tokenId, recipientHash: hashEmail(session.recipientEmail) }
  );
  assert.equal(opportunityProductsCleared, true);
  assert.equal((quoteSelection as Array<{ productId: string }>)[0].productId, product.productId);
  assert.equal(savedPatch.ht_surveyselectedproductids, undefined);
  assert.equal(savedPatch.ht_surveypropertytype, "Semi-Detached");
  assert.equal(savedPatch.ht_propertytype, 123160001);
  assert.equal(savedPatch.ht_loftboardingrequired, false);
  assert.equal(savedPatch.ht_lightrequired, 123160002);
  assert.equal(savedPatch.ht_surveyautomationlasterror, null);
  assert.equal(result.quoteId, "99999999-9999-4999-8999-999999999999");
  assert.equal(finalExpectedVersion, undefined);
});

test("rejects a tampered survey Choice before changing Dataverse", async () => {
  let called = false;
  const dataverse = { getSession: async () => { called = true; return session; } } as unknown as DataverseClient;
  const service = new SurveyAutomationService(config(), dataverse, {} as GraphClient);
  await assert.rejects(
    service.submitSurvey(
      { sessionId: session.id, response: "accepted", selectedProductIds: [], details: { propertyType: "fregr" } },
      { sessionId: session.id, tokenId: session.tokenId, recipientHash: hashEmail(session.recipientEmail) }
    ),
    /Invalid survey choice for propertyType/
  );
  assert.equal(called, false);
});

test("records a survey processing failure on the Opportunity with its reference", async () => {
  let savedPatch: Record<string, unknown> = {};
  const dataverse = {
    updateSession: async (_id: string, patch: Record<string, unknown>) => { savedPatch = patch; }
  } as unknown as DataverseClient;
  const service = new SurveyAutomationService(config(), dataverse, {} as GraphClient);

  await service.recordSurveyFailure(session.opportunityId, new Error("Quote Product creation failed"), "error-reference-123");

  assert.match(String(savedPatch.ht_surveyautomationlasterror), /Reference: error-reference-123/);
  assert.match(String(savedPatch.ht_surveyautomationlasterror), /Quote Product creation failed/);
});
