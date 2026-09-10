import type { OpportunityContext, ProductOption } from "../domain/models.js";

export function buildSurveyCard(input: {
  originatorId: string;
  context: OpportunityContext;
  products: readonly ProductOption[];
  scheduledStart: string;
  scheduledEnd: string;
  actionUrl: string;
  token: string;
  formUrl: string;
}): object {
  const choices = input.products.slice(0, 20).map(product => ({
    title: `${product.name} (${product.priceDisplayText?.trim() || `${product.priceIsIndicative ? "From " : ""}GBP ${product.price.toFixed(2)}${product.unitName ? ` / ${product.unitName}` : ""}`})`,
    value: product.productId
  }));
  return {
    type: "AdaptiveCard",
    version: "1.0",
    originator: input.originatorId,
    hideOriginalBody: false,
    $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
    body: [
      { type: "TextBlock", size: "Large", weight: "Bolder", text: "Your loft survey" },
      { type: "TextBlock", wrap: true, text: `Hello ${input.context.customer.name}, your survey is proposed for ${input.scheduledStart}.` },
      { type: "FactSet", facts: [
        { title: "Region", value: input.context.region.name },
        { title: "Property", value: [input.context.streetName, input.context.propertyPostcode].filter(Boolean).join(", ") },
        { title: "Finish", value: input.scheduledEnd }
      ] },
      { type: "Input.ChoiceSet", id: "selectedProducts", label: "Products you want us to discuss", isMultiSelect: true, style: "expanded", choices },
      { type: "Input.Text", id: "reason", label: "Notes or reason", isMultiline: true },
      {
        type: "TextBlock",
        wrap: true,
        isSubtle: true,
        text: choices.length < input.products.length
          ? `Showing ${choices.length} options. Use the full form to see all products.`
          : "You can change these choices in the full form."
      }
    ],
    actions: [
      httpAction("Accept and submit", input.actionUrl, "accepted", input.token, true),
      httpAction("Request another time", input.actionUrl, "reschedule_requested", input.token, true),
      httpAction("Decline", input.actionUrl, "declined", input.token, true),
      { type: "Action.OpenUrl", title: "Open full survey form", url: input.formUrl }
    ]
  };
}

export function buildInstallationCard(input: {
  originatorId: string;
  orderName: string;
  start: string;
  end: string;
  actionUrl: string;
  token: string;
  formUrl: string;
}): object {
  return {
    type: "AdaptiveCard",
    version: "1.0",
    originator: input.originatorId,
    hideOriginalBody: false,
    $schema: "https://adaptivecards.io/schemas/adaptive-card.json",
    body: [
      { type: "TextBlock", size: "Large", weight: "Bolder", text: "Confirm your installation" },
      { type: "TextBlock", wrap: true, text: `${input.orderName}: ${input.start} to ${input.end}` },
      { type: "Input.Text", id: "reason", label: "Message or reason", isMultiline: true }
    ],
    actions: [
      httpAction("Accept installation", input.actionUrl, "accepted", input.token),
      httpAction("Request another time", input.actionUrl, "reschedule_requested", input.token),
      httpAction("Decline", input.actionUrl, "declined", input.token),
      { type: "Action.OpenUrl", title: "Open details", url: input.formUrl }
    ]
  };
}

function httpAction(title: string, url: string, response: string, token: string, includeProducts = false): object {
  const payload: Record<string, string> = { response, token, reason: "{{reason.value}}" };
  if (includeProducts) payload.selectedProducts = "{{selectedProducts.value}}";
  return {
    type: "Action.Http",
    title,
    method: "POST",
    url,
    headers: [{ name: "Content-Type", value: "application/json" }],
    body: JSON.stringify(payload)
  };
}
