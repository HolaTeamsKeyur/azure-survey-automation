import { z } from "zod";

const guid = z.string().uuid();

export class WebhookPayloadError extends Error {}

/** Normalises JSON copied from rich-text editors and Power Automate string bodies. */
export function parseWebhookPayload(raw: string): unknown {
  const normalised = raw.replace(/\u00a0/g, " ").trim();
  if (!normalised) throw new WebhookPayloadError("Request body must contain JSON.");
  const parsed: unknown = JSON.parse(normalised);
  if (typeof parsed !== "string") return parsed;
  return JSON.parse(parsed.replace(/\u00a0/g, " "));
}

/** Accepts either the small manual payload or a Dataverse RemoteExecutionContext. */
export function extractDataverseRecordId(payload: unknown, directProperty: string): string {
  if (!payload || typeof payload !== "object") throw new WebhookPayloadError("Request body must be a JSON object.");
  const body = payload as Record<string, unknown>;
  const candidates = [
    body[directProperty],
    body.PrimaryEntityId,
    body.primaryEntityId,
    targetId(body.InputParameters),
    targetId(body.inputParameters)
  ];
  for (const candidate of candidates) {
    const parsed = guid.safeParse(candidate);
    if (parsed.success) return parsed.data;
  }
  throw new WebhookPayloadError(`Request requires ${directProperty} or a Dataverse PrimaryEntityId.`);
}

function targetId(inputParameters: unknown): unknown {
  if (!Array.isArray(inputParameters)) return undefined;
  for (const item of inputParameters) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    if (String(entry.key ?? entry.Key ?? "").toLowerCase() !== "target") continue;
    const value = (entry.value ?? entry.Value) as Record<string, unknown> | undefined;
    return value?.Id ?? value?.id;
  }
  return undefined;
}
