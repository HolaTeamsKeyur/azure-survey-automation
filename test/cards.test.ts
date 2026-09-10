import assert from "node:assert/strict";
import test from "node:test";
import { buildInstallationCard, buildSurveyCard } from "../src/messages/cards.js";

test("survey card includes Outlook Action.Http and fallback", () => {
  const card = buildSurveyCard({
    originatorId: "originator-test",
    context: {
      opportunityId: "11111111-1111-4111-8111-111111111111", name: "Example", customer: { contactId: "22222222-2222-4222-8222-222222222222", name: "Customer", email: "customer@example.com" },
      region: { id: "33333333-3333-4333-8333-333333333333", name: "Wigan", senderMailbox: "sender@example.com", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: true }
    },
    products: [{ productId: "44444444-4444-4444-8444-444444444444", unitId: "55555555-5555-4555-8555-555555555555", name: "Boarding", quantity: 1, price: 100, selectedByDefault: true, sortOrder: 1 }],
    scheduledStart: "2026-09-10T09:00:00Z", scheduledEnd: "2026-09-10T10:00:00Z",
    actionUrl: "https://example.test/api/action/survey", token: "signed-token", formUrl: "https://example.test/api/survey/signed-token"
  }) as { actions: Array<{ type: string; url?: string }> };
  assert.equal(card.actions[0].type, "Action.Http");
  assert.ok(card.actions.some(action => action.type === "Action.OpenUrl" && action.url?.includes("/survey/")));
});

test("installation card has three responses and hosted fallback", () => {
  const card = buildInstallationCard({
    originatorId: "originator-test",
    orderName: "Order 1001",
    start: "2026-09-20T09:00:00Z",
    end: "2026-09-20T17:00:00Z",
    actionUrl: "https://example.test/api/action/installation",
    token: "signed-token",
    formUrl: "https://example.test/api/installation/signed-token"
  }) as { actions: Array<{ type: string; title: string; url?: string; body?: string }> };

  assert.equal(card.actions.filter(action => action.type === "Action.Http").length, 3);
  assert.ok(card.actions.some(action => action.type === "Action.OpenUrl" && action.url?.includes("/installation/")));
  assert.ok(card.actions.filter(action => action.type === "Action.Http").every(action => !action.body?.includes("selectedProducts")));
});
