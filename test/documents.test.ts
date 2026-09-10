import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import PizZip from "pizzip";
import { buildSurveyDocumentModel, renderSurveyDocumentTemplate } from "../src/infrastructure/documents.js";

const context = {
  opportunityId: "11111111-1111-4111-8111-111111111111",
  name: "OPP-1001",
  customer: { contactId: "22222222-2222-4222-8222-222222222222", name: "Customer", email: "customer@example.com" },
  region: {
    id: "33333333-3333-4333-8333-333333333333", name: "Leeds", telephone: "0113 000 0000",
    senderMailbox: "leeds@example.com", timeZone: "Europe/London", surveyDurationMinutes: 60,
    businessDayStartHour: 9, businessDayEndHour: 17, autoScheduleEnabled: true
  }
};

const products = [
  { productId: "55555555-5555-4555-8555-555555555555", unitId: "66666666-6666-4666-8666-666666666666", name: "Ladder", quantity: 1, price: 200, selectedByDefault: false, sortOrder: 20 },
  { productId: "44444444-4444-4444-8444-444444444444", unitId: "77777777-7777-4777-8777-777777777777", unitName: "m2", name: "Boarding", quantity: 1, price: 67.5, priceIsIndicative: true, selectedByDefault: false, sortOrder: 10 }
];

test("builds a deterministically ordered catalogue with blank pre-survey totals", () => {
  const model = buildSurveyDocumentModel(context, products, "2026-09-10T09:00:00Z") as { region_telephone: string; subtotal: string; products: Array<{ name: string; quantity: string }> };
  assert.equal(model.region_telephone, "0113 000 0000");
  assert.equal(model.subtotal, "");
  assert.deepEqual(model.products.map(row => row.name), ["Boarding", "Ladder"]);
  assert.ok(model.products.every(row => row.quantity === ""));
});

test("renders selected quantities and subtotal without inventing VAT", () => {
  const model = buildSurveyDocumentModel(context, products, "2026-09-10T09:00:00Z", [{
    productId: products[0].productId, quantity: 2, name: "Ladder", unitId: products[0].unitId,
    unitPrice: 200, lineNet: 400, priceIsIndicative: false
  }]) as { subtotal: string; vat_total: string; grand_total: string; products: Array<{ name: string; quantity: number | string; line_net: string }> };
  assert.equal(model.subtotal, "GBP 400.00");
  assert.equal(model.vat_total, "");
  assert.equal(model.grand_total, "");
  assert.equal(model.products.find(row => row.name === "Ladder")?.quantity, 2);
  assert.equal(model.products.find(row => row.name === "Ladder")?.line_net, "GBP 400.00");
});

test("renders the generated Word baseline with one row per regional product", () => {
  const template = readFileSync(new URL("../templates/survey-template.baseline.docx", import.meta.url));
  const model = buildSurveyDocumentModel(context, products, "2026-09-10T09:00:00Z");
  const rendered = renderSurveyDocumentTemplate(template, model);
  const documentXml = new PizZip(rendered).file("word/document.xml")?.asText() ?? "";
  const headerXml = new PizZip(rendered).file("word/header1.xml")?.asText() ?? "";
  assert.ok(rendered.length > 0);
  assert.match(documentXml, /Boarding/);
  assert.match(documentXml, /Ladder/);
  assert.match(headerXml, /Leeds/);
  assert.doesNotMatch(documentXml + headerXml, /\{[#/]?[a-z_]+\}/);
});
