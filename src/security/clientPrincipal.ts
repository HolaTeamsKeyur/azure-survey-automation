import type { HttpRequest } from "@azure/functions";
import type { AppConfig } from "../config.js";

interface ClientPrincipalClaim { typ: string; val: string }

export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims?: ClientPrincipalClaim[];
}

export class SurveyorAccessError extends Error {}

export function readClientPrincipal(request: HttpRequest): ClientPrincipal | undefined {
  const encoded = request.headers.get("x-ms-client-principal");
  if (!encoded) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as ClientPrincipal;
    if (!parsed || !Array.isArray(parsed.userRoles) || !parsed.userId) return undefined;
    return parsed;
  } catch {
    throw new Error("The signed-in user information is invalid.");
  }
}

export function assertSurveyorAccess(config: AppConfig, principal: ClientPrincipal | undefined, assignedEmail: string): void {
  if (!config.requireSurveyorAuth) return;
  if (!principal || !principal.userRoles.includes("authenticated") || principal.identityProvider !== "aad") {
    throw new SurveyorAccessError("Microsoft Entra sign-in is required.");
  }
  const claims = new Map((principal.claims ?? []).map(claim => [claim.typ.toLowerCase(), claim.val]));
  const tenantId = claim(claims, "tid", "http://schemas.microsoft.com/identity/claims/tenantid");
  if (config.azureTenantId && tenantId?.toLowerCase() !== config.azureTenantId) {
    throw new SurveyorAccessError("This account is not in the authorised Microsoft Entra tenant.");
  }
  const signedInEmail = claim(
    claims,
    "preferred_username",
    "email",
    "emails",
    "upn",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn"
  ) ?? principal.userDetails;
  if (config.surveyorAccessMode === "assigned" && normalizeEmail(signedInEmail) !== normalizeEmail(assignedEmail)) {
    throw new SurveyorAccessError("This survey is assigned to a different surveyor.");
  }
}

export function surveyorLoginUrl(publicBaseUrl: string, token: string): string {
  const returnPath = `/api/survey/${encodeURIComponent(token)}`;
  return `${publicBaseUrl}/.auth/login/aad?post_login_redirect_uri=${encodeURIComponent(returnPath)}`;
}

function claim(claims: ReadonlyMap<string, string>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = claims.get(name.toLowerCase());
    if (value) return value;
  }
  return undefined;
}

function normalizeEmail(value: string): string { return value.trim().toLowerCase(); }
