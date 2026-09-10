import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";
import { loadConfig } from "../config.js";
import { correlationId, publicFormErrorMessage } from "../http/responses.js";
import { verifySurveyToken } from "../security/tokens.js";
import { SurveyAutomationService } from "../services/surveyAutomation.js";
import { renderSurveyForm, renderSurveyThanks, surveyPageHeaders } from "../views/surveyPage.js";
import { assertSurveyorAccess, readClientPrincipal, SurveyorAccessError, surveyorLoginUrl } from "../security/clientPrincipal.js";
import type { NewProductRequest } from "../domain/models.js";

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const requestId = correlationId(request);
  try {
    const config = loadConfig();
    const token = String(request.params.token ?? "");
    const claims = await verifySurveyToken(config, token);
    const principal = readClientPrincipal(request);
    if (config.requireSurveyorAuth && !principal && request.method === "GET") {
      return { status: 302, headers: { "Location": surveyorLoginUrl(config.publicBaseUrl, token), "Cache-Control": "no-store" } };
    }
    const service = new SurveyAutomationService(config);
    const model = await service.getSurveyForm(claims);
    assertSurveyorAccess(config, principal, model.session.recipientEmail);
    if (request.method === "GET") {
      return { status: 200, headers: surveyPageHeaders(requestId), body: renderSurveyForm({ token, context: model.context, scheduledStart: model.session.scheduledStart, products: model.products, layout: model.layout, enableNewProductRequests: config.enableNewProductRequests }) };
    }

    const form = await request.formData();
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
      },
      newProductRequests: readNewProductRequests(form)
    }, claims);
    return { status: 200, headers: surveyPageHeaders(requestId), body: renderSurveyThanks(result.productCount, result.requestedProductCount, result.quoteId) };
  } catch (error) {
    context.error(`Survey form request failed. Correlation ID: ${requestId}`, error);
    if (error instanceof SurveyorAccessError) {
      return { status: 403, headers: surveyPageHeaders(requestId), body: accessDeniedPage(error.message) };
    }
    return { status: 400, headers: surveyPageHeaders(requestId), body: errorPage(publicFormErrorMessage()) };
  }
}

app.http("surveyForm", { methods: ["GET", "POST"], authLevel: "anonymous", route: "survey/{token}", handler });

function optional(value: FormDataEntryValue | null): string | undefined { const result = String(value ?? "").trim(); return result || undefined; }
function numberOptional(value: FormDataEntryValue | null): number | undefined { const text = String(value ?? "").trim(); if (!text) return undefined; const result = Number(text); if (!Number.isFinite(result)) throw new Error("A measurement is invalid."); return result; }
function number(value: FormDataEntryValue | null): number { const text = String(value ?? "").trim(); if (!text) return 0; const result = Number(text); if (!Number.isFinite(result)) throw new Error("A product quantity is invalid."); return result; }
function readNewProductRequests(form: FormData): NewProductRequest[] {
  const requests: NewProductRequest[] = [];
  for (let index = 0; index < 10; index++) {
    const name = optional(form.get(`newProductName_${index}`));
    const description = optional(form.get(`newProductDescription_${index}`));
    const unitName = optional(form.get(`newProductUnit_${index}`));
    const justification = optional(form.get(`newProductJustification_${index}`));
    const quantityText = optional(form.get(`newProductQuantity_${index}`));
    const priceText = optional(form.get(`newProductEstimatedPrice_${index}`));
    if (!name && !description && !unitName && !justification && !quantityText && !priceText) continue;
    requests.push({
      name: name ?? "",
      description,
      quantity: quantityText ? number(form.get(`newProductQuantity_${index}`)) : 1,
      unitName,
      estimatedUnitPrice: priceText ? number(form.get(`newProductEstimatedPrice_${index}`)) : undefined,
      justification
    });
  }
  return requests;
}
function errorPage(message: string): string { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unable to continue</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:10vh auto;padding:2rem}h1{color:#0969ad}</style></head><body><h1>Unable to continue</h1><p>${escapeHtml(message)}</p><p>Please contact your local Access4Lofts team.</p></body></html>`; }
function accessDeniedPage(message: string): string { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access denied</title><style>body{font-family:Arial,sans-serif;max-width:700px;margin:10vh auto;padding:2rem}h1{color:#0969ad}a{color:#0969ad}</style></head><body><h1>Access denied</h1><p>${escapeHtml(message)}</p><p>Sign in with an authorised HolaTeams Microsoft 365 account, or contact the Access4Lofts office.</p><p><a href="/.auth/logout?post_logout_redirect_uri=/">Sign out and use another account</a></p></body></html>`; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
