import assert from "node:assert/strict";
import test from "node:test";
import { buildInstallationCard } from "../src/messages/cards.js";

test("installation email card has three inline responses and a hosted fallback", () => {
  const card = buildInstallationCard({
    originatorId: "originator-test", orderName: "Order 1001", start: "2026-09-20T09:00:00Z", end: "2026-09-20T17:00:00Z",
    actionUrl: "https://example.test/api/action/installation", token: "signed-token", formUrl: "https://example.test/api/installation/signed-token"
  }) as { actions: Array<{ type: string; url?: string; body?: string }> };
  assert.equal(card.actions.filter(action => action.type === "Action.Http").length, 3);
  assert.ok(card.actions.some(action => action.type === "Action.OpenUrl" && action.url?.includes("/installation/")));
  assert.ok(card.actions.filter(action => action.type === "Action.Http").every(action => !action.body?.includes("selectedProducts")));
});
