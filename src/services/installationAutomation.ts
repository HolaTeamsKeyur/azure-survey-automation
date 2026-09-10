import { randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import type { InstallationSubmission } from "../domain/models.js";
import { assertInstallationTransition, validateInstallationSubmission } from "../domain/rules.js";
import { DataverseClient } from "../infrastructure/dataverse.js";
import { GraphClient } from "../infrastructure/graph.js";
import { buildInstallationCard } from "../messages/cards.js";
import { issueInstallationToken, type SurveyTokenClaims } from "../security/tokens.js";
import { hashEmail } from "./surveyAutomation.js";

export class InstallationAutomationService {
  constructor(
    private readonly config: AppConfig,
    private readonly dataverse = new DataverseClient(config.dataverseUrl),
    private readonly graph = new GraphClient()
  ) {}

  async request(orderId: string): Promise<InstallationRequestResult> {
    const context = await this.dataverse.getInstallationContext(orderId);
    const existing = await this.dataverse.findOpenInstallationSession(context.orderId);
    if (existing && !["expired", "failed"].includes(existing.status)) {
      const token = await issueInstallationToken(this.config, {
        sessionId: existing.id,
        tokenId: existing.tokenId,
        recipientHash: hashEmail(existing.recipientEmail)
      });
      return installationRequestResult(this.config.publicBaseUrl, context, existing.id, token, true);
    }

    const tokenId = randomUUID();
    const session = await this.dataverse.createInstallationSession({
      orderId: context.orderId,
      recipientEmail: context.recipientEmail.toLowerCase(),
      scheduledStart: context.scheduledStart,
      scheduledEnd: context.scheduledEnd,
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      status: "draft",
      tokenId
    });
    const claims: SurveyTokenClaims = {
      sessionId: session.id,
      tokenId,
      recipientHash: hashEmail(session.recipientEmail)
    };
    const token = await issueInstallationToken(this.config, claims);
    const formUrl = `${this.config.publicBaseUrl}/api/installation/${encodeURIComponent(token)}`;
    const card = this.config.enableActionableMessages ? buildInstallationCard({
      originatorId: this.config.ACTIONABLE_ORIGINATOR_ID,
      orderName: context.orderName,
      start: context.scheduledStart,
      end: context.scheduledEnd,
      actionUrl: `${this.config.publicBaseUrl}/api/action/installation`,
      token,
      formUrl
    }) : undefined;
    const fallback = `<p>Hello ${escapeHtml(context.recipientName)},</p><p>Please confirm your installation: ${escapeHtml(context.scheduledStart)} to ${escapeHtml(context.scheduledEnd)}.</p><p><a href="${escapeHtml(formUrl)}">Open the secure confirmation form</a></p>`;

    try {
      if (this.config.sendInstallationEmail) {
        await this.graph.sendActionableMail(
          context.senderMailbox || this.config.GRAPH_SENDER_MAILBOX,
          context.recipientEmail,
          `Confirm your Access4Lofts installation - ${context.orderName}`,
          fallback,
          card
        );
      }
      assertInstallationTransition("draft", "sent");
      await this.dataverse.setInstallationSessionStatus(session.id, "sent", session.version);
      return installationRequestResult(this.config.publicBaseUrl, context, session.id, token, false);
    } catch (error) {
      await this.dataverse.setInstallationSessionStatus(session.id, "failed");
      throw error;
    }
  }

  async submit(input: InstallationSubmission, claims: SurveyTokenClaims): Promise<{ status: string }> {
    const submission = validateInstallationSubmission(input);
    const session = await this.dataverse.getInstallationSession(claims.sessionId);
    if (session.tokenId !== claims.tokenId || hashEmail(session.recipientEmail) !== claims.recipientHash) {
      throw new Error("Installation token does not match the session.");
    }
    if (new Date(session.expiresAt) <= new Date()) throw new Error("Installation confirmation link has expired.");
    if (["accepted", "declined", "reschedule_requested"].includes(session.status)) return { status: session.status };
    assertInstallationTransition(session.status, submission.response);
    await this.dataverse.updateInstallationResponse(session, submission);
    return { status: submission.response };
  }

  async getForm(claims: SurveyTokenClaims) {
    const session = await this.dataverse.getInstallationSession(claims.sessionId);
    if (session.tokenId !== claims.tokenId || hashEmail(session.recipientEmail) !== claims.recipientHash) {
      throw new Error("Installation token does not match the session.");
    }
    if (new Date(session.expiresAt) <= new Date()) throw new Error("Installation confirmation link has expired.");
    return session;
  }
}

interface InstallationRequestResult {
  sessionId: string;
  reused: boolean;
  orderId: string;
  orderName: string;
  formUrl: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  scheduledStart: string;
  scheduledEnd: string;
}

function installationRequestResult(
  publicBaseUrl: string,
  context: Awaited<ReturnType<DataverseClient["getInstallationContext"]>>,
  sessionId: string,
  token: string,
  reused: boolean
): InstallationRequestResult {
  return {
    sessionId,
    reused,
    orderId: context.orderId,
    orderName: context.orderName,
    formUrl: `${publicBaseUrl}/api/installation/${encodeURIComponent(token)}`,
    recipientEmail: context.recipientEmail,
    recipientName: context.recipientName,
    subject: `Confirm your Access4Lofts installation - ${context.orderName}`,
    scheduledStart: context.scheduledStart,
    scheduledEnd: context.scheduledEnd
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
