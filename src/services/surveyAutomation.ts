import { createHash, randomUUID } from "node:crypto";
import type { AppConfig } from "../config.js";
import type { OpportunityContext, ProductOption, SurveySubmission } from "../domain/models.js";
import { assertTransition, splitProductIds, validateProductSelections, validateSurveySubmission } from "../domain/rules.js";
import { findFirstAvailableSlot } from "../domain/scheduling.js";
import { DataverseClient } from "../infrastructure/dataverse.js";
import { SurveyDocumentService } from "../infrastructure/documents.js";
import { GraphClient, type MailAttachment } from "../infrastructure/graph.js";
import { issueSurveyToken, type SurveyTokenClaims } from "../security/tokens.js";

export class SurveyAutomationService {
  private readonly documents?: SurveyDocumentService;

  constructor(
    private readonly config: AppConfig,
    private readonly dataverse = new DataverseClient(config.dataverseUrl),
    private readonly graph = new GraphClient(),
    documents?: SurveyDocumentService
  ) {
    this.documents = documents ?? (config.enableWordDocument && config.TEMPLATE_STORAGE_URL
      ? new SurveyDocumentService(config.TEMPLATE_STORAGE_URL)
      : undefined);
  }

  async requestSurvey(opportunityId: string): Promise<{
    sessionId: string;
    reused: boolean;
    formUrl: string;
    recipientEmail: string;
    recipientName: string;
    subject: string;
  }> {
    const context = await this.dataverse.getOpportunityContext(opportunityId);
    const existing = await this.dataverse.findOpenSession(context.opportunityId);
    if (existing && !["expired", "declined", "failed"].includes(existing.status)) {
      const token = await issueSurveyToken(this.config, {
        sessionId: existing.id,
        tokenId: existing.tokenId,
        recipientHash: hashEmail(existing.recipientEmail)
      });
      return surveyRequestResult(this.config.publicBaseUrl, context, existing.id, token, true);
    }

    if (!context.priceListId) {
      throw new Error(`Opportunity ${context.name} requires a Price List, or its Region Franchise Account requires a Default Price List.`);
    }
    const products = await this.dataverse.getRegionProducts(context.priceListId);
    if (!products.length) throw new Error("The Opportunity Price List has no products.");
    const surveyorMailbox = context.region.surveyorMailbox;
    if (!surveyorMailbox) throw new Error("The Opportunity requires a Surveyor with an internal email address.");

    const searchStart = new Date(Date.now() + 24 * 60 * 60_000);
    const searchEnd = new Date(searchStart.getTime() + 21 * 86_400_000);
    const busy = await this.graph.getBusyPeriods(
      surveyorMailbox,
      searchStart.toISOString(),
      searchEnd.toISOString(),
      this.config.DEFAULT_TIME_ZONE
    );
    const slot = findFirstAvailableSlot(searchStart, this.config.DEFAULT_SURVEY_DURATION_MINUTES, {
      startHour: this.config.SURVEY_BUSINESS_START_HOUR,
      endHour: this.config.SURVEY_BUSINESS_END_HOUR,
      workingDays: [1, 2, 3, 4, 5]
    }, busy, this.config.DEFAULT_TIME_ZONE);

    const tokenId = randomUUID();
    const selected = products.filter(product => product.selectedByDefault).map(product => product.productId);
    const session = await this.dataverse.createSession({
      opportunityId: context.opportunityId,
      recipientEmail: context.customer.email.toLowerCase(),
      regionId: context.region.id,
      scheduledStart: slot.start.toISOString(),
      scheduledEnd: slot.end.toISOString(),
      expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      status: "draft",
      allowedProductIds: products.map(product => product.productId),
      productsSnapshot: products,
      selectedProductIds: selected,
      selectionSnapshot: [],
      tokenId
    });

    try {
      const appointmentId = await this.dataverse.createSurveyAppointment(
        context,
        session.scheduledStart,
        session.scheduledEnd
      );
      await this.dataverse.updateSession(session.id, { ht_surveyeventid: appointmentId });

      const claims: SurveyTokenClaims = {
        sessionId: session.id,
        tokenId,
        recipientHash: hashEmail(session.recipientEmail)
      };
      const token = await issueSurveyToken(this.config, claims);
      const formUrl = `${this.config.publicBaseUrl}/api/survey/${encodeURIComponent(token)}`;
      const attachments: MailAttachment[] = [];
      if (this.config.enableWordDocument) {
        if (!this.documents) throw new Error("Word document generation is enabled but template storage is not configured.");
        const document = await this.documents.render(
          this.config.TEMPLATE_CONTAINER,
          this.config.SURVEY_TEMPLATE_BLOB,
          context,
          products,
          session.scheduledStart
        );
        attachments.push({
          name: "Access4Lofts-Survey.docx",
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          contentBytes: document.toString("base64")
        });
      }
      const fallback = `<p>Hello ${escapeHtml(context.customer.name)},</p><p>Your survey is proposed for ${escapeHtml(session.scheduledStart)}.</p><p><a href="${escapeHtml(formUrl)}">Open the secure survey form</a></p>`;
      if (this.config.sendSurveyEmail) {
        await this.graph.sendActionableMail(
          context.region.senderMailbox || this.config.GRAPH_SENDER_MAILBOX,
          context.customer.email,
          `Your Access4Lofts survey - ${context.name}`,
          fallback,
          undefined,
          attachments
        );
      }
      assertTransition("draft", "sent");
      await this.dataverse.setSessionStatus(session.id, "sent");
      return surveyRequestResult(this.config.publicBaseUrl, context, session.id, token, false);
    } catch (error) {
      await this.dataverse.updateSession(session.id, {
        ht_surveyautomationstatuskey: "failed",
        ht_surveyautomationlasterror: safeError(error)
      });
      throw error;
    }
  }

  async submitSurvey(
    input: SurveySubmission,
    tokenClaims: SurveyTokenClaims
  ): Promise<{ status: string; productCount: number; quoteId?: string }> {
    const submission = validateSurveySubmission(input);
    const session = await this.dataverse.getSession(submission.sessionId);
    if (session.tokenId !== tokenClaims.tokenId || hashEmail(session.recipientEmail) !== tokenClaims.recipientHash) {
      throw new Error("Survey token does not match the Opportunity.");
    }
    if (new Date(session.expiresAt) <= new Date()) throw new Error("Survey link has expired.");
    if (["accepted", "declined", "reschedule_requested"].includes(session.status)) {
      return { status: session.status, productCount: session.selectionSnapshot.length };
    }
    assertTransition(session.status, submission.response);

    const commonPatch = {
      ht_surveyautomationstatuskey: submission.response,
      ht_surveyresponsereason: submission.reason ?? null,
      ht_surveyfeedbackscore: submission.feedbackScore ?? null,
      ht_surveyfeedbackcomments: submission.feedbackComments ?? null,
      ht_surveyrespondedon: new Date().toISOString()
    };
    if (submission.response !== "accepted") {
      await this.dataverse.updateSession(session.id, {
        ...commonPatch,
        ht_surveyproductreviewstatuskey: "not_received"
      }, session.version);
      return { status: submission.response, productCount: 0 };
    }

    const requested = submission.productSelections ?? submission.selectedProductIds.map(productId => ({
      productId,
      quantity: session.productsSnapshot.find(product => product.productId.toLowerCase() === productId.toLowerCase())?.quantity ?? 1
    }));
    const selected = validateProductSelections(requested, session.productsSnapshot);
    const context = await this.dataverse.getOpportunityContext(session.opportunityId);
    if (!context.priceListId) throw new Error("The Opportunity has no regional Price List.");
    await this.dataverse.applyOpportunityPriceList(session.opportunityId, context.priceListId);
    await this.dataverse.upsertOpportunityProducts(session.opportunityId, selected);
    const quote = this.config.createQuoteOnSubmit
      ? await this.dataverse.generateQuoteFromOpportunity(session.opportunityId)
      : undefined;
    await this.dataverse.updateSession(session.id, {
      ...commonPatch,
      ...surveyDetailsPatch(submission.details),
      ht_surveyselectedproductids: selected.map(product => product.productId).join(","),
      ht_surveyselectionsnapshotjson: JSON.stringify(selected),
      ht_surveyproductreviewstatuskey: "applied"
    }, session.version);
    return { status: "accepted", productCount: selected.length, quoteId: quote?.quoteId };
  }

  async getSurveyForm(tokenClaims: SurveyTokenClaims): Promise<{
    session: Awaited<ReturnType<DataverseClient["getSession"]>>;
    context: Awaited<ReturnType<DataverseClient["getOpportunityContext"]>>;
    products: ProductOption[];
  }> {
    const session = await this.dataverse.getSession(tokenClaims.sessionId);
    if (session.tokenId !== tokenClaims.tokenId || hashEmail(session.recipientEmail) !== tokenClaims.recipientHash) {
      throw new Error("Survey token does not match the Opportunity.");
    }
    if (new Date(session.expiresAt) <= new Date()) throw new Error("Survey link has expired.");
    const context = await this.dataverse.getOpportunityContext(session.opportunityId);
    return { session, context, products: session.productsSnapshot };
  }

  parseProductSelection(value: string | undefined): string[] {
    return splitProductIds(value);
  }
}

function surveyRequestResult(
  publicBaseUrl: string,
  context: OpportunityContext,
  sessionId: string,
  token: string,
  reused: boolean
) {
  return {
    sessionId,
    reused,
    formUrl: `${publicBaseUrl}/api/survey/${encodeURIComponent(token)}`,
    recipientEmail: context.customer.email,
    recipientName: context.customer.name,
    subject: `Your Access4Lofts survey - ${context.name}`
  };
}

function surveyDetailsPatch(details: SurveySubmission["details"]): Record<string, unknown> {
  if (!details) return {};
  return {
    ht_surveyaddress: details.address ?? null,
    ht_surveypropertytype: details.propertyType ?? null,
    ht_surveypropertyage: details.propertyAge ?? null,
    ht_surveyadvertisingsource: details.advertisingSource ?? null,
    ht_surveyexistinghatchtype: details.existingHatchType ?? null,
    ht_surveyflooringrequired: details.flooringRequired ?? null,
    ht_surveyladderrequired: details.ladderRequired ?? null,
    ht_surveylightrequired: details.lightRequired ?? null,
    ht_surveyinsulationrequired: details.insulationRequired ?? null,
    ht_surveyotherinformation: details.otherInformation ?? null,
    ht_quotationdate: details.quotationDate ?? null,
    ht_surveyhousetype: details.houseType ?? null,
    ht_surveyrooftype: details.roofType ?? null,
    ht_surveyceilingheightcm: details.ceilingHeightCm ?? null,
    ht_surveyhatchtopwidthcm: details.hatchTopWidthCm ?? null,
    ht_surveyhatchtoplengthcm: details.hatchTopLengthCm ?? null,
    ht_surveyhatchinsidewidthcm: details.hatchInsideWidthCm ?? null,
    ht_surveyhatchinsidelengthcm: details.hatchInsideLengthCm ?? null,
    ht_surveyladderclearancewidthcm: details.ladderClearanceWidthCm ?? null,
    ht_surveyladderarcclearancecm: details.ladderArcClearanceCm ?? null,
    ht_surveyladderarctype: details.ladderArcType ?? null,
    ht_surveyplannotes: details.planNotes ?? null,
    ht_surveyadditionalinfo: details.additionalInfo ?? null
  };
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 4000);
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
