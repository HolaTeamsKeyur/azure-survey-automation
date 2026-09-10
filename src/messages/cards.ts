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

function httpAction(title: string, url: string, response: string, token: string): object {
  return {
    type: "Action.Http",
    title,
    method: "POST",
    url,
    headers: [{ name: "Content-Type", value: "application/json" }],
    body: JSON.stringify({ response, token, reason: "{{reason.value}}" })
  };
}
