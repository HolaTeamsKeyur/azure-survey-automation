export const surveySectionKeys = ["job", "property", "measurements", "notes", "products", "new_products", "review"] as const;
export type SurveySectionKey = typeof surveySectionKeys[number];

export interface SurveyLayoutSection {
  key: SurveySectionKey;
  title: string;
  helpText?: string;
  visible: boolean;
}

export interface SurveyLayout {
  version: number;
  title: string;
  sections: SurveyLayoutSection[];
}

export const defaultSurveyLayout: SurveyLayout = {
  version: 1,
  title: "Property survey",
  sections: [
    { key: "job", title: "Customer", helpText: "Information from Dynamics 365", visible: true },
    { key: "property", title: "Survey details", helpText: "Information from the enquiry is already filled in. Open to check or update it on site.", visible: true },
    { key: "measurements", title: "Measurements", helpText: "Enter measurements in centimetres", visible: true },
    { key: "notes", title: "Plan and notes", visible: true },
    { key: "products", title: "Select products", helpText: "Enter a quantity to add a product to this opportunity.", visible: true },
    { key: "new_products", title: "Product not listed?", helpText: "Request a product for office review; it will not be priced automatically", visible: false },
    { key: "review", title: "Review and submit", visible: true }
  ]
};

export function parseSurveyLayout(value: string): SurveyLayout {
  const input = JSON.parse(value) as Partial<SurveyLayout>;
  if (!Number.isInteger(input.version) || !Array.isArray(input.sections)) throw new Error("Survey layout JSON is invalid.");
  const seen = new Set<SurveySectionKey>();
  const sections = input.sections.map(section => {
    if (!section || typeof section !== "object") throw new Error("Survey layout contains an invalid section.");
    const key = String(section.key) as SurveySectionKey;
    if (!surveySectionKeys.includes(key) || seen.has(key)) throw new Error(`Survey layout section ${key} is invalid or duplicated.`);
    seen.add(key);
    const title = String(section.title ?? "").trim();
    if (!title || title.length > 100) throw new Error(`Survey layout section ${key} requires a valid title.`);
    const helpText = section.helpText === undefined ? undefined : String(section.helpText).trim();
    if (helpText && helpText.length > 250) throw new Error(`Survey layout section ${key} help text is too long.`);
    return { key, title, helpText: helpText || undefined, visible: section.visible !== false };
  });
  if (!seen.has("review")) throw new Error("Survey layout must include the review section.");
  return { version: input.version as number, title: String(input.title ?? "Property survey").slice(0, 100), sections };
}
