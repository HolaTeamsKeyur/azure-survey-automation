import assert from "node:assert/strict";
import test from "node:test";
import type { TokenCredential } from "@azure/identity";
import { DataverseClient } from "../src/infrastructure/dataverse.js";

test("resolves franchise identity, Opportunity Price List and prefilled survey details", async () => {
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
      _pricelevelid_value: "55555555-5555-4555-8555-555555555555",
      parentcontactid: { contactid: "22222222-2222-4222-8222-222222222222", fullname: "Jamie Taylor", emailaddress1: "jamie@example.test" },
      ht_Region: { ht_regionid: "33333333-3333-4333-8333-333333333333", ht_name: "Brighton Region", _ht_franchise_value: "44444444-4444-4444-8444-444444444444" }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/accounts(")) return new Response(JSON.stringify({ name: "Brighton" }), { status: 200, headers: { "Content-Type": "application/json" } });
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

test("loads only survey-enabled Products from the Opportunity Price List", async () => {
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
        productid: { name: "New uPVC hatch", ht_showincustomersurvey: true },
        uomid: { name: "Primary Unit" }
      }, {
        productpricelevelid: "55555555-5555-4555-8555-555555555555",
        _productid_value: "66666666-6666-4666-8666-666666666666",
        _uomid_value: "33333333-3333-8333-8333-333333333333",
        amount: 50,
        productid: { name: "Internal fitting", ht_showincustomersurvey: false },
        uomid: { name: "Each" }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    const products = await new DataverseClient("https://example.crm.dynamics.com", credential).getOpportunityPriceListProducts(
      "44444444-4444-4444-8444-444444444444"
    );
    assert.equal(products.length, 1);
    assert.equal(products[0].price, 124.17);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestedUrl, /_pricelevelid_value eq 44444444-4444-4444-8444-444444444444/);
  assert.match(requestedUrl, /productid\(\$select=productid,name,description,ht_showincustomersurvey\)/);
  assert.doesNotMatch(requestedUrl, /and ht_showincustomersurvey/);
  assert.doesNotMatch(requestedUrl, /statecode/);
});

test("refreshes an existing draft Quote with only the selected products", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes("quotes?$select")) return new Response(JSON.stringify({ value: [{ quoteid: "11111111-1111-4111-8111-111111111111" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("quotedetails?$select")) return new Response(JSON.stringify({ value: [{ quotedetailid: "22222222-2222-4222-8222-222222222222" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    const result = await new DataverseClient("https://example.crm.dynamics.com", credential).generateQuoteFromOpportunity(
      "33333333-3333-4333-8333-333333333333",
      [{ productId: "44444444-4444-4444-8444-444444444444", unitId: "55555555-5555-4555-8555-555555555555", name: "Boarding", quantity: 3, unitPrice: 60, lineNet: 180, priceIsIndicative: false }]
    );
    assert.deepEqual(result, { quoteId: "11111111-1111-4111-8111-111111111111", reused: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls.some(call => call.url.endsWith("/GenerateQuoteFromOpportunity")), false);
  assert.ok(calls.some(call => call.url.includes("quotedetails(22222222-2222-4222-8222-222222222222)") && call.init?.method === "DELETE"));
  const create = calls.find(call => call.url.endsWith("/quotedetails") && call.init?.method === "POST");
  assert.ok(create);
  const body = JSON.parse(String(create.init?.body));
  assert.equal(body.quantity, 3);
  assert.equal(body["productid@odata.bind"], "/products(44444444-4444-4444-8444-444444444444)");
});

test("replaces Opportunity Products with exactly the submitted selection", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes("opportunityproducts?$select")) return new Response(JSON.stringify({ value: [{ opportunityproductid: "44444444-4444-4444-8444-444444444444", _productid_value: "99999999-9999-4999-8999-999999999999" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    await new DataverseClient("https://example.crm.dynamics.com", credential).replaceOpportunityProducts(
      "11111111-1111-4111-8111-111111111111",
      [{ productId: "22222222-2222-4222-8222-222222222222", unitId: "33333333-3333-4333-8333-333333333333", name: "Boarding", quantity: 12.5, unitPrice: 60, lineNet: 750, priceIsIndicative: true }]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  const create = calls.find(call => call.init?.method === "POST");
  const removed = calls.find(call => call.url.includes("opportunityproducts(44444444-4444-4444-8444-444444444444)") && call.init?.method === "DELETE");
  assert.ok(removed);
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
    if (url.includes("quotedetails?$select")) {
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
    const quote = await client.generateQuoteFromOpportunity("11111111-1111-4111-8111-111111111111", [{ productId: "66666666-6666-4666-8666-666666666666", unitId: "77777777-7777-4777-8777-777777777777", name: "Boarding", quantity: 2, unitPrice: 60, lineNet: 120, priceIsIndicative: false }]);
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
  const quoteLine = calls.find(call => call.url.endsWith("/quotedetails") && call.init?.method === "POST");
  assert.ok(quoteLine);
  const quoteLineBody = JSON.parse(String(quoteLine.init?.body));
  assert.equal(quoteLineBody["quoteid@odata.bind"], "/quotes(55555555-5555-4555-8555-555555555555)");
  assert.equal(quoteLineBody["productid@odata.bind"], "/products(66666666-6666-4666-8666-666666666666)");
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
