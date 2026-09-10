import assert from "node:assert/strict";
import test from "node:test";
import { parseSurveyLayout } from "../src/domain/surveyLayout.js";

test("accepts safe section configuration and rejects arbitrary keys", () => {
  const layout = parseSurveyLayout(JSON.stringify({ version: 2, title: "Site visit", sections: [{ key: "products", title: "Catalogue", visible: true }, { key: "review", title: "Finish", visible: true }] }));
  assert.deepEqual(layout.sections.map(section => section.key), ["products", "review"]);
  assert.throws(() => parseSurveyLayout(JSON.stringify({ version: 1, sections: [{ key: "raw_html", title: "Unsafe" }, { key: "review", title: "Finish" }] })), /invalid or duplicated/);
  assert.throws(() => parseSurveyLayout(JSON.stringify({ version: 1, sections: [{ key: "products", title: "Products" }] })), /must include the review/);
});
