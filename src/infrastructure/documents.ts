import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { OpportunityContext, ProductOption, SurveyProductSelectionSnapshot } from "../domain/models.js";

export class SurveyDocumentService {
  private readonly blobs: BlobServiceClient;
  constructor(storageUrl: string, credential: TokenCredential = new DefaultAzureCredential()) {
    this.blobs = new BlobServiceClient(storageUrl, credential);
  }

  async render(
    container: string,
    blobName: string,
    context: OpportunityContext,
    products: readonly ProductOption[],
    scheduledStart: string,
    selections: readonly SurveyProductSelectionSnapshot[] = []
  ): Promise<Buffer> {
    const download = await this.blobs.getContainerClient(container).getBlobClient(blobName).download();
    const bytes = await streamToBuffer(download.readableStreamBody);
    return renderSurveyDocumentTemplate(bytes, buildSurveyDocumentModel(context, products, scheduledStart, selections));
  }
}

export function renderSurveyDocumentTemplate(template: Buffer, model: Record<string, unknown>): Buffer {
  const zip = new PizZip(template);
  const document = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  document.render(model);
  return document.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

export function buildSurveyDocumentModel(
  context: OpportunityContext,
  products: readonly ProductOption[],
  scheduledStart: string,
  selections: readonly SurveyProductSelectionSnapshot[] = []
): Record<string, unknown> {
  const selected = new Map(selections.map(item => [item.productId.toLowerCase(), item]));
  const rows = [...products].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).map(product => {
    const selection = selected.get(product.productId.toLowerCase());
    return {
      display_order: product.sortOrder,
      name: product.name,
      description: product.description ?? "",
      price_display: product.priceDisplayText?.trim() || `${product.priceIsIndicative ? "From " : ""}GBP ${product.price.toFixed(2)}${product.unitName ? ` / ${product.unitName}` : ""}`,
      unit: product.unitName ?? "",
      quantity: selection?.quantity ?? "",
      line_net: selection ? formatMoney(selection.lineNet) : ""
    };
  });
  const subtotal = selections.length ? roundMoney(selections.reduce((sum, item) => sum + item.lineNet, 0)) : undefined;
  return {
    customer_name: context.customer.name,
    customer_email: context.customer.email,
    customer_mobile: context.customer.mobile ?? "",
    opportunity_name: context.name,
    region_name: context.region.name,
    region_telephone: context.region.telephone ?? "",
    region_email: context.region.senderMailbox,
    property_postcode: context.propertyPostcode ?? "",
    street_name: context.streetName ?? "",
    survey_start: scheduledStart,
    pricing_notice: "Survey worksheet / indicative prices - not a quotation",
    products: rows,
    subtotal: subtotal === undefined ? "" : formatMoney(subtotal),
    vat_total: "",
    grand_total: ""
  };
}

async function streamToBuffer(stream: NodeJS.ReadableStream | undefined): Promise<Buffer> {
  if (!stream) throw new Error("Template blob returned no content.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
function formatMoney(value: number): string { return `GBP ${value.toFixed(2)}`; }
