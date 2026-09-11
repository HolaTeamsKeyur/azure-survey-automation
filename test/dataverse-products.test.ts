import assert from "node:assert/strict";
import test from "node:test";
import type { TokenCredential } from "@azure/identity";
import { DataverseClient } from "../src/infrastructure/dataverse.js";

test("resolves franchise identity, default price list and prefilled survey details", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input); calls.push(url);
    if (url.includes("/opportunities(")) return new Response(JSON.stringify({
      opportunityid: "11111111-1111-4111-8111-111111111111",
      name: "Enquiry 100",
      ht_streetname: "10 Test Road",
      ht_propertypostcode: "BN1 1AA",
      ht_propertytype: 1,
      "ht_propertytype@OData.Community.Display.V1.FormattedValue": "Semi-detached",
      ht_loftboardingrequired: true,
      parentcontactid: { contactid: "22222222-2222-4222-8222-222222222222", fullname: "Jamie Taylor", emailaddress1: "jamie@example.test" },
      ht_Region: { ht_regionid: "33333333-3333-4333-8333-333333333333", ht_name: "Brighton Region", _ht_franchise_value: "44444444-4444-4444-8444-444444444444" }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/accounts(")) return new Response(JSON.stringify({ name: "Brighton", _defaultpricelevelid_value: "55555555-5555-4555-8555-555555555555" }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    const context = await new DataverseClient("https://example.crm.dynamics.com", credential).getOpportunityContext("11111111-1111-4111-8111-111111111111");
    assert.equal(context.region.franchiseName, "Brighton");
    assert.equal(context.priceListId, "55555555-5555-4555-8555-555555555555");
    assert.equal(context.surveyDetails?.propertyType, "Semi-detached");
    assert.equal(context.surveyDetails?.flooringRequired, "Yes");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.ok(calls.some(url => url.includes("/accounts(44444444-4444-4444-8444-444444444444)")));
  const opportunityCall = calls.find(url => url.includes("/opportunities("));
  assert.ok(opportunityCall);
  assert.doesNotMatch(opportunityCall, /ht_surveyaddress/);
});

test("saves only optional Opportunity survey columns that exist in Dataverse", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/EntityDefinitions(LogicalName='opportunity')/Attributes")) {
      return new Response(JSON.stringify({
        value: [
          { LogicalName: "ht_surveypropertytype" },
          { LogicalName: "ht_surveyautomationstatuskey" }
        ]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    await new DataverseClient("https://example.crm.dynamics.com", credential).updateSession(
      "11111111-1111-4111-8111-111111111111",
      {
        ht_surveyaddress: "10 Test Road",
        ht_surveypropertytype: "Semi-detached",
        ht_surveyautomationstatuskey: "submitted"
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const update = calls.find(call => call.init?.method === "PATCH");
  assert.ok(update);
  const body = JSON.parse(String(update.init?.body));
  assert.equal(body.ht_surveyaddress, undefined);
  assert.equal(body.ht_surveypropertytype, "Semi-detached");
  assert.equal(body.ht_surveyautomationstatuskey, "submitted");
});

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

test("creates a pending governed request instead of a Product master record", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    await new DataverseClient("https://example.crm.dynamics.com", credential).createNewProductRequests(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      [{ name: "Special trim", quantity: 2, unitName: "each", justification: "Required on site" }]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /ht_surveyproductrequests\(ht_sourcekey='11111111-1111-4111-8111-111111111111:1'\)$/);
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(calls[0].init?.method, "PATCH");
  assert.equal(body.ht_sourcekey, "11111111-1111-4111-8111-111111111111:1");
  assert.equal(body["transactioncurrencyid@odata.bind"], "/transactioncurrencies(33333333-3333-4333-8333-333333333333)");
  assert.equal(body.ht_statuskey, "pending");
  assert.equal(body["ht_Opportunity@odata.bind"], "/opportunities(11111111-1111-4111-8111-111111111111)");
  assert.equal(body.productid, undefined);
});
