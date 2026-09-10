import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInstallationTransition,
  assertTransition,
  splitProductIds,
  validateInstallationSubmission,
  validateProductSelections,
  validateSelectedProducts,
  validateSurveySubmission
} from "../src/domain/rules.js";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";

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
