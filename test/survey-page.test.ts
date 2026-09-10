import assert from "node:assert/strict";
import test from "node:test";
import { renderSurveyForm } from "../src/views/surveyPage.js";

test("renders the record-specific Access4Lofts form without developer dashboard content", () => {
  const html = renderSurveyForm({
    token: "signed-token",
    scheduledStart: "2026-09-15T10:00:00+01:00",
    context: {
      opportunityId: "11111111-1111-4111-8111-111111111111", name: "Enquiry 100", streetName: "10 Test Road", propertyPostcode: "BN1 1AA",
      customer: { contactId: "22222222-2222-4222-8222-222222222222", name: "Jamie Taylor", email: "jamie@example.test", mobile: "07700 900123" },
      region: { id: "33333333-3333-4333-8333-333333333333", name: "Brighton", telephone: "01273 034001", senderMailbox: "brighton@example.test", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: true }
    },
    products: [{ productId: "44444444-4444-4444-8444-444444444444", unitId: "55555555-5555-4555-8555-555555555555", name: "Loft boarding", quantity: 1, price: 60, priceDisplayText: "From £60.00 per sq m", selectedByDefault: false, sortOrder: 1 }]
  });

  assert.match(html, /CUSTOMER ENQUIRY FORM/);
  assert.match(html, /SURVEY AND QUOTATION FORM/);
  assert.match(html, /Jamie Taylor/);
  assert.match(html, /Brighton/);
  assert.match(html, /Loft boarding/);
  assert.match(html, /name="quantity_44444444-4444-4444-8444-444444444444"/);
  assert.doesNotMatch(html, /mock mode|control room|sample record|Adaptive Card/i);
});
