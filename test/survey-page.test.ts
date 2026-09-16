import assert from "node:assert/strict";
import test from "node:test";
import { renderSurveyForm, renderSurveyThanks, surveyPageHeaders } from "../src/views/surveyPage.js";

test("completed survey shows a Dynamics Quote button when a Quote exists", () => {
  const quoteUrl = "https://example.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=quote&id=11111111-1111-4111-8111-111111111111";
  const html = renderSurveyThanks(4, 0, quoteUrl);
  assert.match(html, /Open quote in Dynamics 365/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /etn=quote&amp;id=11111111-1111-4111-8111-111111111111/);
});

test("completed survey hides the Quote button while product requests await review", () => {
  const html = renderSurveyThanks(4, 1);
  assert.doesNotMatch(html, /Open quote in Dynamics 365/);
});

test("renders the surveyor-facing property workflow without demo content", () => {
  const html = renderSurveyForm({
    token: "signed-token",
    scheduledStart: "2026-09-15T10:00:00+01:00",
    context: {
      opportunityId: "11111111-1111-4111-8111-111111111111", name: "Enquiry 100", streetName: "10 Test Road", propertyPostcode: "BN1 1AA",
      surveyorUserId: "66666666-6666-4666-8666-666666666666",
      surveyDetails: { propertyType: "Semi-Detached", propertyAge: "1900-1939", existingHatchType: "Pushup", flooringRequired: "No", ladderRequired: "Yes", lightRequired: "Already Installed", insulationRequired: "No", advertisingSource: "Web" },
      customer: { contactId: "22222222-2222-4222-8222-222222222222", name: "Jamie Taylor", email: "jamie@example.test", mobile: "07700 900123" },
      region: { id: "33333333-3333-4333-8333-333333333333", name: "Brighton Region", franchiseName: "Access4Lofts Brighton", telephone: "01273 034001", senderMailbox: "brighton@example.test", surveyorMailbox: "surveyor@example.test", surveyorName: "Alex Surveyor", surveyorUserId: "66666666-6666-4666-8666-666666666666", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: false }
    },
    products: [{ productId: "44444444-4444-4444-8444-444444444444", unitId: "55555555-5555-4555-8555-555555555555", name: "Loft boarding", quantity: 1, price: 60, priceDisplayText: "From £60.00 per sq m", selectedByDefault: false, sortOrder: 1 }],
    enableNewProductRequests: true
  });

  assert.match(html, /Property survey/);
  assert.match(html, /Customer survey worksheet/);
  assert.match(html, /Jamie Taylor/);
  assert.match(html, /alt="Access4Lofts"/);
  assert.match(html, /<strong>Brighton<\/strong>/);
  assert.doesNotMatch(html, /Access4Lofts Access4Lofts/);
  assert.match(html, /<select name="propertyType">/);
  assert.match(html, /<option value="Semi-Detached" selected>Semi-Detached<\/option>/);
  assert.match(html, /<option value="1900-1939" selected>1900-1939<\/option>/);
  assert.match(html, /<option value="Already Installed" selected>Already Installed<\/option>/);
  assert.match(html, /<option value="Web" selected>Web<\/option>/);
  assert.equal((html.match(/<select name="/g) ?? []).length, 8);
  assert.match(html, /Loft boarding/);
  assert.match(html, /name="selected_44444444-4444-4444-8444-444444444444"/);
  assert.match(html, /name="quantity_44444444-4444-4444-8444-444444444444"/);
  assert.match(html, /id="product-search"/);
  assert.match(html, /id="submission-status"/);
  assert.match(html, /Only these products will be added to the draft Quote/);
  assert.doesNotMatch(html, /placed on the Opportunity and draft Quote/);
  assert.match(html, /data-product-search="loft boarding"/);
  assert.match(html, /from this Opportunity's Price List/);
  assert.doesNotMatch(html, /Request a product/);
  assert.doesNotMatch(html, /mock mode|control room|sample record|Adaptive Card|customer enquiry form/i);
});

test("allows the same-origin background survey submission", () => {
  assert.match(surveyPageHeaders("request-id")["Content-Security-Policy"], /connect-src 'self'/);
});

test("shows every Opportunity Price List product in one scrollable form", () => {
  const products = Array.from({ length: 12 }, (_, index) => ({
    productId: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
    unitId: "55555555-5555-4555-8555-555555555555",
    name: `Product ${index + 1}`,
    quantity: 1,
    price: 10,
    selectedByDefault: false,
    sortOrder: index + 1
  }));
  const html = renderSurveyForm({
    token: "signed-token",
    scheduledStart: "2026-09-15T10:00:00+01:00",
    context: {
      opportunityId: "11111111-1111-4111-8111-111111111111", name: "Enquiry 100", streetName: "10 Test Road", propertyPostcode: "BN1 1AA",
      customer: { contactId: "22222222-2222-4222-8222-222222222222", name: "Jamie Taylor", email: "jamie@example.test" },
      region: { id: "33333333-3333-4333-8333-333333333333", name: "Brighton", senderMailbox: "brighton@example.test", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: false }
    },
    products
  });
  assert.match(html, /Showing 12 survey-enabled products/);
  assert.match(html, /placeholder="Search by product name or description"/);
  assert.doesNotMatch(html, /Show all products/);
  assert.equal((html.match(/class="product-row/g) ?? []).length, 12);
  assert.match(html, /\.field-list\{display:flex;flex-direction:column/);
  assert.match(html, /\.product-row\{display:grid;grid-template-columns:minmax\(0,1fr\) 150px 105px/);
});
