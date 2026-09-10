import assert from "node:assert/strict";
import test from "node:test";
import type { TokenCredential } from "@azure/identity";
import { DataverseClient } from "../src/infrastructure/dataverse.js";

test("creates a standard Opportunity Product from a submitted regional product", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes("opportunityproducts?$select")) return new Response(JSON.stringify({ value: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    await new DataverseClient("https://example.crm.dynamics.com", credential).upsertOpportunityProducts(
      "11111111-1111-4111-8111-111111111111",
      [{ productId: "22222222-2222-4222-8222-222222222222", unitId: "33333333-3333-4333-8333-333333333333", name: "Boarding", quantity: 12.5, unitPrice: 60, lineNet: 750, priceIsIndicative: true }]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  const create = calls.find(call => call.init?.method === "POST");
  assert.ok(create);
  const body = JSON.parse(String(create.init?.body));
  assert.equal(body.quantity, 12.5);
  assert.equal(body.priceperunit, 60);
  assert.equal(body.ispriceoverridden, true);
  assert.equal(body["opportunityid@odata.bind"], "/opportunities(11111111-1111-4111-8111-111111111111)");
  assert.equal(body["productid@odata.bind"], "/products(22222222-2222-4222-8222-222222222222)");
});
