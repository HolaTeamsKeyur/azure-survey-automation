import assert from "node:assert/strict";
import test from "node:test";
import { extractDataverseRecordId, parseWebhookPayload } from "../src/domain/webhook.js";

const id = "9d65f9cf-84c0-4fe1-8184-2621bcaaf24d";

test("extracts the direct demonstration payload", () => {
  assert.equal(extractDataverseRecordId({ opportunityId: id }, "opportunityId"), id);
});

test("accepts Dataverse GUIDs that do not contain an RFC UUID version nibble", () => {
  const dataverseId = "986d8a4f-05ad-f111-aaac-6045bd00754c";
  assert.equal(extractDataverseRecordId({ opportunityId: dataverseId }, "opportunityId"), dataverseId);
  assert.equal(extractDataverseRecordId({ opportunityId: `{${dataverseId}}` }, "opportunityId"), dataverseId);
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

test("normalises rich-text whitespace and double-encoded Power Automate JSON", () => {
  assert.deepEqual(parseWebhookPayload(`{\u00a0"opportunityId":\u00a0"${id}"\u00a0}`), { opportunityId: id });
  assert.deepEqual(parseWebhookPayload(JSON.stringify(JSON.stringify({ opportunityId: id }))), { opportunityId: id });
});
