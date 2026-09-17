import assert from "node:assert/strict";
import test from "node:test";
import type { TokenCredential } from "@azure/identity";
import { DataverseClient } from "../src/infrastructure/dataverse.js";

test("resolves franchise identity, Franchise default Price List and prefilled survey details", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes("/opportunities(") && init?.method === "PATCH") return new Response(null, { status: 204 });
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
  assert.ok(calls.some(call => call.url.includes("/accounts(44444444-4444-4444-8444-444444444444)")));
  const opportunityCall = calls.find(call => call.url.includes("/opportunities(") && !call.init?.method);
  assert.ok(opportunityCall);
  assert.doesNotMatch(opportunityCall.url, /ht_surveyaddress/);
  assert.doesNotMatch(opportunityCall.url, /leadsourcecode/);
  const opportunityPatch = calls.find(call => call.url.includes("/opportunities(") && call.init?.method === "PATCH");
  assert.ok(opportunityPatch);
  assert.equal(
    JSON.parse(String(opportunityPatch.init?.body))["pricelevelid@odata.bind"],
    "/pricelevels(55555555-5555-4555-8555-555555555555)"
  );
});

test("prefills missing Opportunity survey fields from the originating Enquiry and persists them", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes("/EntityDefinitions(LogicalName='opportunity')/Attributes")) {
      return new Response(JSON.stringify({ value: [
        { LogicalName: "ht_surveyaddress" }, { LogicalName: "ht_surveypropertytype" }, { LogicalName: "ht_surveypropertyage" },
        { LogicalName: "ht_surveyadvertisingsource" }, { LogicalName: "ht_surveyexistinghatchtype" }, { LogicalName: "ht_surveyflooringrequired" },
        { LogicalName: "ht_surveyladderrequired" }, { LogicalName: "ht_surveylightrequired" }, { LogicalName: "ht_surveyinsulationrequired" },
        { LogicalName: "ht_surveyotherinformation" }, { LogicalName: "ht_streetname" }, { LogicalName: "ht_propertypostcode" },
        { LogicalName: "ht_propertytype" }, { LogicalName: "ht_propertyage" }, { LogicalName: "ht_existinghatchtype" },
        { LogicalName: "ht_loftboardingrequired" }, { LogicalName: "ht_loftladderrequired" }, { LogicalName: "ht_lightrequired" },
        { LogicalName: "ht_insulationrequired" }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/EntityDefinitions(LogicalName='lead')/Attributes")) {
      return new Response(JSON.stringify({ value: [
        { LogicalName: "ht_propertytype" }, { LogicalName: "ht_propertyage" }, { LogicalName: "ht_existinghatchtype" },
        { LogicalName: "ht_loftboardingrequired" }, { LogicalName: "ht_loftladderrequired" }, { LogicalName: "ht_lightrequired" },
        { LogicalName: "ht_insulationrequired" }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/opportunities(") && init?.method === "PATCH") return new Response(null, { status: 204 });
    if (url.includes("/opportunities(")) return new Response(JSON.stringify({
      opportunityid: "11111111-1111-4111-8111-111111111111", name: "Enquiry 101",
      _originatingleadid_value: "99999999-9999-4999-8999-999999999999",
      _pricelevelid_value: "55555555-5555-4555-8555-555555555555",
      ht_surveyflooringrequired: "Opportunity override",
      parentcontactid: { contactid: "22222222-2222-4222-8222-222222222222", fullname: "Jamie Taylor", emailaddress1: "jamie@example.test" },
      ht_Region: { ht_regionid: "33333333-3333-4333-8333-333333333333", ht_name: "Brighton" }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/leads(")) return new Response(JSON.stringify({
      address1_line1: "10 Test Road", address1_city: "Brighton", address1_postalcode: "BN1 1AA",
      ht_propertytype: 1, "ht_propertytype@OData.Community.Display.V1.FormattedValue": "Semi-detached",
      ht_propertyage: 2, "ht_propertyage@OData.Community.Display.V1.FormattedValue": "1930s",
      ht_existinghatchtype: 3, "ht_existinghatchtype@OData.Community.Display.V1.FormattedValue": "Push-up",
      ht_loftboardingrequired: true, ht_loftladderrequired: false, ht_lightrequired: true, ht_insulationrequired: false,
      leadsourcecode: 4, "leadsourcecode@OData.Community.Display.V1.FormattedValue": "Website",
      description: "Call before arrival"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    const context = await new DataverseClient("https://example.crm.dynamics.com", credential).getOpportunityContext("11111111-1111-4111-8111-111111111111");
    assert.equal(context.streetName, "10 Test Road, Brighton");
    assert.equal(context.propertyPostcode, "BN1 1AA");
    assert.equal(context.surveyDetails?.address, "10 Test Road, Brighton, BN1 1AA");
    assert.equal(context.surveyDetails?.propertyType, "Semi-detached");
    assert.equal(context.surveyDetails?.propertyAge, "1930s");
    assert.equal(context.surveyDetails?.advertisingSource, "Website");
    assert.equal(context.surveyDetails?.existingHatchType, "Push-up");
    assert.equal(context.surveyDetails?.flooringRequired, "Opportunity override");
    assert.equal(context.surveyDetails?.ladderRequired, "No");
    assert.equal(context.surveyDetails?.lightRequired, "Yes");
    assert.equal(context.surveyDetails?.insulationRequired, "No");
    assert.equal(context.surveyDetails?.otherInformation, "Call before arrival");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.ok(calls.some(call => call.url.includes("/leads(99999999-9999-4999-8999-999999999999)")));
  const leadCall = calls.find(call => call.url.includes("/leads(99999999-9999-4999-8999-999999999999)"));
  assert.ok(leadCall);
  assert.doesNotMatch(leadCall.url, /ht_propertypostcode|ht_streetname/);
  const patchCall = calls.find(call => call.init?.method === "PATCH");
  assert.ok(patchCall);
  const patchBody = JSON.parse(String(patchCall.init?.body));
  assert.equal(patchBody.ht_surveypropertytype, "Semi-detached");
  assert.equal(patchBody.ht_surveylightrequired, "Yes");
  assert.equal(patchBody.ht_surveyflooringrequired, undefined);
  assert.equal(patchBody.ht_streetname, "10 Test Road, Brighton");
  assert.equal(patchBody.ht_propertypostcode, "BN1 1AA");
  assert.equal(patchBody.ht_propertytype, 1);
  assert.equal(patchBody.ht_lightrequired, true);
  assert.equal(patchBody.leadsourcecode, undefined);
  assert.equal(patchBody.ht_surveyadvertisingsource, "Website");
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
          { LogicalName: "ht_surveyautomationlasterror" },
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
        ht_surveyautomationlasterror: "Reference: test",
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
  assert.equal(body.ht_surveyautomationlasterror, "Reference: test");
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
  assert.doesNotMatch(requestedUrl, /ht_surveydisplayorder/);
  assert.doesNotMatch(requestedUrl, /\$orderby/);
});

test("finds the latest Quote for a completed Opportunity", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      value: [{ quoteid: "11111111-1111-4111-8111-111111111111", createdon: "2026-09-15T14:13:51Z" }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    const quoteId = await new DataverseClient("https://example.crm.dynamics.com", credential)
      .getLatestQuoteIdForOpportunity("22222222-2222-4222-8222-222222222222");
    assert.equal(quoteId, "11111111-1111-4111-8111-111111111111");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requestedUrl, /_opportunityid_value eq 22222222-2222-4222-8222-222222222222/);
  assert.match(requestedUrl, /\$orderby=createdon desc&\$top=1/);
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

test("clears all legacy Opportunity Products without creating replacements", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    if (url.includes("opportunityproducts?$select")) return new Response(JSON.stringify({ value: [{ opportunityproductid: "44444444-4444-4444-8444-444444444444" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const credential = { getToken: async () => ({ token: "test", expiresOnTimestamp: Date.now() + 60_000 }) } as TokenCredential;
  try {
    await new DataverseClient("https://example.crm.dynamics.com", credential).clearOpportunityProducts(
      "11111111-1111-4111-8111-111111111111"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  const removed = calls.find(call => call.url.includes("opportunityproducts(44444444-4444-4444-8444-444444444444)") && call.init?.method === "DELETE");
  assert.ok(removed);
  assert.equal(calls.some(call => call.init?.method === "POST" || call.init?.method === "PATCH"), false);
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
