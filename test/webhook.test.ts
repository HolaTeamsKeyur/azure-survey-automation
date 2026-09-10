import assert from "node:assert/strict";
import test from "node:test";
import { extractDataverseRecordId } from "../src/domain/webhook.js";

const id = "9d65f9cf-84c0-4fe1-8184-2621bcaaf24d";

test("extracts the direct demonstration payload", () => {
  assert.equal(extractDataverseRecordId({ opportunityId: id }, "opportunityId"), id);
});

test("extracts PrimaryEntityId from a Dataverse webhook", () => {
  assert.equal(extractDataverseRecordId({ PrimaryEntityId: id }, "opportunityId"), id);
});

test("extracts Target Id from Dataverse InputParameters", () => {
  const payload = { InputParameters: [{ key: "Target", value: { Id: id } }] };
  assert.equal(extractDataverseRecordId(payload, "opportunityId"), id);
});

test("rejects malformed webhook payloads", () => {
  assert.throws(() => extractDataverseRecordId({ PrimaryEntityId: "bad" }, "opportunityId"));
});
