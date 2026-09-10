import assert from "node:assert/strict";
import test from "node:test";
import type { TokenCredential } from "@azure/identity";
import { DataverseClient } from "../src/infrastructure/dataverse.js";

test("loads survey-enabled regional Price List Items without an invalid statecode filter", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      value: [{
        productpricelevelid: "11111111-1111-4111-8111-111111111111",
        _productid_value: "22222222-2222-4222-8222-222222222222",
        _uomid_value: "33333333-3333-4333-8333-333333333333",
        amount: 124.17,
        ht_surveydisplayorder: 1,
        ht_surveypricedisplaytext: "£124.17",
        ht_surveypriceisindicative: false,
        productid: { name: "New uPVC hatch" },
        uomid: { name: "Primary Unit" }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    const products = await new DataverseClient("https://example.crm.dynamics.com", credential).getRegionProducts(
      "44444444-4444-4444-8444-444444444444"
    );
    assert.equal(products.length, 1);
    assert.equal(products[0].price, 124.17);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestedUrl, /ht_showincustomersurvey eq true/);
  assert.doesNotMatch(requestedUrl, /statecode/);
});

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

test("applies the regional price list and generates one quote from the opportunity", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("pricelevels(")) {
      return new Response(JSON.stringify({ _transactioncurrencyid_value: "33333333-3333-4333-8333-333333333333" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("opportunities(") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ _pricelevelid_value: null, _transactioncurrencyid_value: "99999999-9999-4999-8999-999999999999" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("quotes?$select")) {
      return new Response(JSON.stringify({ value: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/GenerateQuoteFromOpportunity")) {
      return new Response(JSON.stringify({ Entity: { quoteid: "55555555-5555-4555-8555-555555555555" } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    const client = new DataverseClient("https://example.crm.dynamics.com", credential);
    await client.applyOpportunityPriceList(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );
    const quote = await client.generateQuoteFromOpportunity("11111111-1111-4111-8111-111111111111");
    assert.deepEqual(quote, { quoteId: "55555555-5555-4555-8555-555555555555", reused: false });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const opportunityPatch = calls.find(call => call.url.includes("/opportunities(") && call.init?.method === "PATCH");
  assert.ok(opportunityPatch);
  const patchBody = JSON.parse(String(opportunityPatch.init?.body));
  assert.equal(patchBody["pricelevelid@odata.bind"], "/pricelevels(22222222-2222-4222-8222-222222222222)");
  assert.equal(patchBody["transactioncurrencyid@odata.bind"], "/transactioncurrencies(33333333-3333-4333-8333-333333333333)");
  const generateCall = calls.find(call => call.url.endsWith("/GenerateQuoteFromOpportunity"));
  assert.ok(generateCall);
  assert.equal(generateCall.init?.method, "POST");
});
