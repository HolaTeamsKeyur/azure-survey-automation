import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInstallationTransition,
  assertTransition,
  normalizeGuid,
  splitProductIds,
  validateInstallationSubmission,
  validateNewProductRequests,
  validateProductSelections,
  validateSelectedProducts,
  validateSurveySubmission
} from "../src/domain/rules.js";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";

test("normalises Dataverse GUIDs without enforcing an RFC UUID version", () => {
  assert.equal(normalizeGuid("{986D8A4F-05AD-F111-AAAC-6045BD00754C}"), "986d8a4f-05ad-f111-aaac-6045bd00754c");
});

test("allows supported survey transition", () => assert.doesNotThrow(() => assertTransition("sent", "accepted")));
test("rejects terminal transition", () => assert.throws(() => assertTransition("accepted", "sent")));
test("normalises and deduplicates card product IDs", () => assert.deepEqual(splitProductIds(`${a}, {${a.toUpperCase()}},${b}`), [a, b]));
test("rejects products outside immutable snapshot", () => {
  assert.throws(() => validateSelectedProducts([b], [{ productId: a, unitId: a, name: "Allowed", quantity: 1, price: 1, selectedByDefault: false, sortOrder: 1 }]));
});
test("validates quantities and calculates immutable line net", () => {
  const result = validateProductSelections(
    [{ productId: a, quantity: 12.5, note: "  Surveyor to confirm  " }],
    [{ productId: a, unitId: b, unitName: "m2", name: "Boarding", quantity: 1, price: 67.5, selectedByDefault: false, sortOrder: 1 }]
  );
  assert.deepEqual(result, [{
    productId: a, quantity: 12.5, note: "Surveyor to confirm", name: "Boarding", unitId: b,
    unitName: "m2", unitPrice: 67.5, lineNet: 843.75, priceDisplayText: undefined, priceIsIndicative: false
  }]);
});
test("rejects duplicate products and invalid quantities", () => {
  const allowed = [{ productId: a, unitId: b, name: "Boarding", quantity: 1, price: 1, selectedByDefault: false, sortOrder: 1 }];
  assert.throws(() => validateProductSelections([{ productId: a, quantity: 1 }, { productId: a, quantity: 2 }], allowed));
  assert.throws(() => validateProductSelections([{ productId: a, quantity: 0 }], allowed));
  assert.throws(() => validateProductSelections([{ productId: a, quantity: 1.2345 }], allowed));
});
test("validates and normalises survey response metadata", () => {
  const result = validateSurveySubmission({
    sessionId: a,
    response: "accepted",
    selectedProductIds: [],
    reason: "  Please call first  ",
    feedbackScore: 5,
    feedbackComments: "  Helpful  "
  });
  assert.equal(result.reason, "Please call first");
  assert.equal(result.feedbackComments, "Helpful");
  assert.throws(() => validateSurveySubmission({ sessionId: a, response: "accepted", selectedProductIds: [], feedbackScore: 2.5 }));
  assert.throws(() => validateSurveySubmission({ sessionId: a, response: "accepted", selectedProductIds: [], reason: "x".repeat(2_001) }));
});
test("enforces installation transitions and input length", () => {
  assert.doesNotThrow(() => assertInstallationTransition("sent", "accepted"));
  assert.throws(() => assertInstallationTransition("draft", "accepted"));
  assert.equal(validateInstallationSubmission({ response: "declined", reason: "  Not required  " }).reason, "Not required");
  assert.throws(() => validateInstallationSubmission({ response: "declined", reason: "x".repeat(2_001) }));
});
test("validates governed non-catalogue product requests", () => {
  assert.deepEqual(validateNewProductRequests([{ name: "  Special trim  ", quantity: 2.5, estimatedUnitPrice: 12.345 }]), [{ name: "Special trim", quantity: 2.5, estimatedUnitPrice: 12.35, description: undefined, unitName: undefined, justification: undefined }]);
  assert.throws(() => validateNewProductRequests([{ name: "", quantity: 1 }]), /requires a name/);
  assert.throws(() => validateNewProductRequests([{ name: "Special trim", quantity: 0 }]), /invalid quantity/);
});
