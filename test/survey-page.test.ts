import assert from "node:assert/strict";
import test from "node:test";
import { renderSurveyForm } from "../src/views/surveyPage.js";

test("renders the surveyor-facing property workflow without demo content", () => {
  const html = renderSurveyForm({
    token: "signed-token",
    scheduledStart: "2026-09-15T10:00:00+01:00",
    context: {
      opportunityId: "11111111-1111-4111-8111-111111111111", name: "Enquiry 100", streetName: "10 Test Road", propertyPostcode: "BN1 1AA",
      surveyorUserId: "66666666-6666-4666-8666-666666666666",
      surveyDetails: { propertyType: "Semi-detached", propertyAge: "1930s", existingHatchType: "Push-up" },
      customer: { contactId: "22222222-2222-4222-8222-222222222222", name: "Jamie Taylor", email: "jamie@example.test", mobile: "07700 900123" },
      region: { id: "33333333-3333-4333-8333-333333333333", name: "Brighton Region", franchiseName: "Brighton", telephone: "01273 034001", senderMailbox: "brighton@example.test", surveyorMailbox: "surveyor@example.test", surveyorName: "Alex Surveyor", surveyorUserId: "66666666-6666-4666-8666-666666666666", timeZone: "Europe/London", surveyDurationMinutes: 60, businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: false }
    },
    products: [{ productId: "44444444-4444-4444-8444-444444444444", unitId: "55555555-5555-4555-8555-555555555555", name: "Loft boarding", quantity: 1, price: 60, priceDisplayText: "From £60.00 per sq m", selectedByDefault: false, sortOrder: 1 }],
    enableNewProductRequests: true
  });

  assert.match(html, /Property survey/);
  assert.match(html, /Franchise catalogue/);
  assert.match(html, /Jamie Taylor/);
  assert.match(html, /Access4Lofts Brighton/);
  assert.match(html, /Brighton Region/);
  assert.match(html, /value="Semi-detached"/);
  assert.match(html, /value="1930s"/);
  assert.match(html, /Loft boarding/);
  assert.match(html, /name="quantity_44444444-4444-4444-8444-444444444444"/);
  assert.doesNotMatch(html, /Request a product/);
  assert.doesNotMatch(html, /mock mode|control room|sample record|Adaptive Card|customer enquiry form/i);
});

test("shows only the first ten regional products initially", () => {
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
  assert.match(html, /Showing 10 of 12 products/);
  assert.match(html, /Show all products/);
  assert.match(html, /data-product-index="9"[^>]*>/);
  assert.match(html, /data-product-index="10"[^>]* hidden>/);
});
