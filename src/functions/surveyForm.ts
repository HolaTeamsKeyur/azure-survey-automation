import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { correlationId, publicFormErrorMessage } from "../http/responses.js";
import { verifySurveyToken } from "../security/tokens.js";
import { SurveyAutomationService } from "../services/surveyAutomation.js";
import { renderSurveyForm, renderSurveyThanks, surveyPageHeaders } from "../views/surveyPage.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    const token = String(request.params.token ?? "");
    const claims = await verifySurveyToken(config, token);
    const service = new SurveyAutomationService(config);
    if (request.method === "GET") {
      const model = await service.getSurveyForm(claims);
      return { status: 200, headers: surveyPageHeaders(requestId), body: renderSurveyForm({ token, context: model.context, scheduledStart: model.session.scheduledStart, products: model.products }) };
    }

    const form = await request.formData();
    const model = await service.getSurveyForm(claims);
    const productSelections = model.products.map(product => ({ productId: product.productId, quantity: number(form.get(`quantity_${product.productId}`)) })).filter(item => item.quantity > 0);
    const result = await service.submitSurvey({
      sessionId: claims.sessionId,
      response: "accepted",
      selectedProductIds: productSelections.map(item => item.productId),
      productSelections,
      details: {
        address: optional(form.get("address")), propertyType: optional(form.get("propertyType")), propertyAge: optional(form.get("propertyAge")), advertisingSource: optional(form.get("advertisingSource")),
        existingHatchType: optional(form.get("existingHatchType")), flooringRequired: optional(form.get("flooringRequired")), ladderRequired: optional(form.get("ladderRequired")), lightRequired: optional(form.get("lightRequired")), insulationRequired: optional(form.get("insulationRequired")), otherInformation: optional(form.get("otherInformation")),
        quotationDate: optional(form.get("quotationDate")), houseType: optional(form.get("houseType")), roofType: optional(form.get("roofType")), ceilingHeightCm: numberOptional(form.get("ceilingHeightCm")),
        hatchTopWidthCm: numberOptional(form.get("hatchTopWidthCm")), hatchTopLengthCm: numberOptional(form.get("hatchTopLengthCm")), hatchInsideWidthCm: numberOptional(form.get("hatchInsideWidthCm")), hatchInsideLengthCm: numberOptional(form.get("hatchInsideLengthCm")),
        ladderClearanceWidthCm: numberOptional(form.get("ladderClearanceWidthCm")), ladderArcClearanceCm: numberOptional(form.get("ladderArcClearanceCm")), ladderArcType: optional(form.get("ladderArcType")), planNotes: optional(form.get("planNotes")), additionalInfo: optional(form.get("additionalInfo"))
      }
    }, claims);
    return { status: 200, headers: surveyPageHeaders(requestId), body: renderSurveyThanks(result.productCount, result.quoteId) };
  } catch (error) {
    context.error(`Survey form request failed. Correlation ID: ${requestId}`, error);
    return { status: 400, headers: surveyPageHeaders(requestId), body: errorPage(publicFormErrorMessage()) };
  }
}

app.http("surveyForm", { methods: ["GET", "POST"], authLevel: "anonymous", route: "survey/{token}", handler });

function optional(value: FormDataEntryValue | null): string | undefined { const result = String(value ?? "").trim(); return result || undefined; }
function numberOptional(value: FormDataEntryValue | null): number | undefined { const text = String(value ?? "").trim(); if (!text) return undefined; const result = Number(text); if (!Number.isFinite(result)) throw new Error("A measurement is invalid."); return result; }
function number(value: FormDataEntryValue | null): number { const text = String(value ?? "").trim(); if (!text) return 0; const result = Number(text); if (!Number.isFinite(result)) throw new Error("A product quantity is invalid."); return result; }
function errorPage(message: string): string { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unable to continue</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:10vh auto;padding:2rem}h1{color:#0969ad}</style></head><body><h1>Unable to continue</h1><p>${escapeHtml(message)}</p><p>Please contact your local Access4Lofts team.</p></body></html>`; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
