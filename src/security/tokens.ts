import { createRemoteJWKSet, decodeJwt, jwtVerify, SignJWT } from "jose";
import type { AppConfig } from "../config.js";

const OUTLOOK_ACTIONS_APP_ID = "48af08dc-f6d2-435f-b2a7-069abd99c086";

export class IngressAuthenticationError extends Error {}

export interface SurveyTokenClaims {
  sessionId: string;
  tokenId: string;
  recipientHash: string;
}

export async function issueSurveyToken(
  config: AppConfig,
  claims: SurveyTokenClaims,
  expiresIn = "14d"
): Promise<string> {
  return new SignJWT({ sid: claims.sessionId, jti: claims.tokenId, rh: claims.recipientHash })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("holateams-survey-automation")
    .setAudience("holateams-customer-survey")
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(config.SURVEY_TOKEN_SECRET));
}

export async function verifySurveyToken(config: AppConfig, token: string): Promise<SurveyTokenClaims> {
  const result = await jwtVerify(token, new TextEncoder().encode(config.SURVEY_TOKEN_SECRET), {
    issuer: "holateams-survey-automation",
    audience: "holateams-customer-survey"
  });
  const sessionId = String(result.payload.sid ?? "");
  const tokenId = String(result.payload.jti ?? "");
  const recipientHash = String(result.payload.rh ?? "");
  if (!sessionId || !tokenId || !recipientHash) throw new Error("Survey token is missing required claims.");
  return { sessionId, tokenId, recipientHash };
}

export async function issueInstallationToken(config: AppConfig, claims: SurveyTokenClaims, expiresIn = "14d"): Promise<string> {
  return new SignJWT({ sid: claims.sessionId, jti: claims.tokenId, rh: claims.recipientHash })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt()
    .setIssuer("holateams-survey-automation").setAudience("holateams-installation-response").setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(config.SURVEY_TOKEN_SECRET));
}

export async function verifyInstallationToken(config: AppConfig, token: string): Promise<SurveyTokenClaims> {
  const result = await jwtVerify(token, new TextEncoder().encode(config.SURVEY_TOKEN_SECRET), {
    issuer: "holateams-survey-automation", audience: "holateams-installation-response"
  });
  const claims = { sessionId: String(result.payload.sid ?? ""), tokenId: String(result.payload.jti ?? ""), recipientHash: String(result.payload.rh ?? "") };
  if (!claims.sessionId || !claims.tokenId || !claims.recipientHash) throw new Error("Installation token is missing required claims.");
  return claims;
}

export async function verifyActionableMessageToken(config: AppConfig, authorization: string | null): Promise<Record<string, unknown>> {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing Outlook Actionable Message authorization token.");
  const unverified = decodeJwt(token);
  const tenantId = String(unverified.tid ?? "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(tenantId)) throw new Error("Action token has no valid tenant ID.");
  if (!config.actionableAllowGlobalTenants && !config.actionableAllowedTenants.includes(tenantId)) {
    throw new Error("Action token tenant is not allowed.");
  }
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const keys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
  const verified = await jwtVerify(token, keys, { issuer, audience: config.ACTIONABLE_APP_ID_URI });
  const caller = String(verified.payload.azp ?? verified.payload.appid ?? "").toLowerCase();
  if (caller !== OUTLOOK_ACTIONS_APP_ID) throw new Error("Token was not issued to the Outlook Actions service.");
  return verified.payload as Record<string, unknown>;
}

export function requireIngressKey(config: AppConfig, supplied: string | null): void {
  if (!supplied || supplied !== config.AUTOMATION_INGRESS_KEY) throw new IngressAuthenticationError("Invalid automation ingress key.");
}
