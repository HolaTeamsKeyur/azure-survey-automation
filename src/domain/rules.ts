import type {
  InstallationSessionStatus,
  InstallationSubmission,
  ProductOption,
  SurveyProductSelection,
  SurveyProductSelectionSnapshot,
  SurveySubmission,
  SurveySessionStatus
} from "./models.js";

const transitions: Record<SurveySessionStatus, ReadonlySet<SurveySessionStatus>> = {
  draft: new Set(["sent", "failed"]),
  sent: new Set(["accepted", "declined", "reschedule_requested", "expired", "failed"]),
  accepted: new Set(),
  declined: new Set(),
  reschedule_requested: new Set(["sent", "declined", "expired"]),
  expired: new Set(),
  failed: new Set(["sent"])
};

export function assertTransition(from: SurveySessionStatus, to: SurveySessionStatus): void {
  if (!transitions[from].has(to)) {
    throw new Error(`Invalid survey-session transition: ${from} -> ${to}`);
  }
}

const installationTransitions: Record<InstallationSessionStatus, ReadonlySet<InstallationSessionStatus>> = {
  draft: new Set(["sent", "failed"]),
  sent: new Set(["accepted", "declined", "reschedule_requested", "expired", "failed"]),
  accepted: new Set(),
  declined: new Set(),
  reschedule_requested: new Set(["sent", "declined", "expired"]),
  expired: new Set(),
  failed: new Set(["sent"])
};

export function assertInstallationTransition(from: InstallationSessionStatus, to: InstallationSessionStatus): void {
  if (!installationTransitions[from].has(to)) {
    throw new Error(`Invalid installation-session transition: ${from} -> ${to}`);
  }
}

export function validateSurveySubmission(input: SurveySubmission): SurveySubmission {
  if (!["accepted", "declined", "reschedule_requested"].includes(input.response)) {
    throw new Error("Invalid survey response.");
  }
  if (!Array.isArray(input.selectedProductIds) || input.selectedProductIds.length > 250) {
    throw new Error("Too many selected products were submitted.");
  }
  if (input.productSelections && (!Array.isArray(input.productSelections) || input.productSelections.length > 250)) {
    throw new Error("Too many product selections were submitted.");
  }
  if (input.feedbackScore !== undefined && (!Number.isInteger(input.feedbackScore) || input.feedbackScore < 1 || input.feedbackScore > 5)) {
    throw new Error("Feedback score must be a whole number from 1 to 5.");
  }
  return {
    ...input,
    reason: normalizeOptionalText(input.reason, 2_000, "Survey reason"),
    feedbackComments: normalizeOptionalText(input.feedbackComments, 2_000, "Survey feedback"),
    details: input.details ? {
      address: normalizeOptionalText(input.details.address, 500, "Address"),
      propertyType: normalizeOptionalText(input.details.propertyType, 250, "Property type"),
      propertyAge: normalizeOptionalText(input.details.propertyAge, 250, "Property age"),
      advertisingSource: normalizeOptionalText(input.details.advertisingSource, 250, "Advertising source"),
      existingHatchType: normalizeOptionalText(input.details.existingHatchType, 250, "Existing hatch type"),
      flooringRequired: normalizeOptionalText(input.details.flooringRequired, 250, "Flooring required"),
      ladderRequired: normalizeOptionalText(input.details.ladderRequired, 250, "Ladder required"),
      lightRequired: normalizeOptionalText(input.details.lightRequired, 250, "Light required"),
      insulationRequired: normalizeOptionalText(input.details.insulationRequired, 250, "Insulation required"),
      otherInformation: normalizeOptionalText(input.details.otherInformation, 4_000, "Other information"),
      quotationDate: normalizeDate(input.details.quotationDate),
      houseType: normalizeOptionalText(input.details.houseType, 250, "House type"),
      roofType: normalizeOptionalText(input.details.roofType, 250, "Roof type"),
      ceilingHeightCm: normalizeMeasurement(input.details.ceilingHeightCm, "Ceiling height"),
      hatchTopWidthCm: normalizeMeasurement(input.details.hatchTopWidthCm, "Top hatch width"),
      hatchTopLengthCm: normalizeMeasurement(input.details.hatchTopLengthCm, "Top hatch length"),
      hatchInsideWidthCm: normalizeMeasurement(input.details.hatchInsideWidthCm, "Inside hatch width"),
      hatchInsideLengthCm: normalizeMeasurement(input.details.hatchInsideLengthCm, "Inside hatch length"),
      ladderClearanceWidthCm: normalizeMeasurement(input.details.ladderClearanceWidthCm, "Ladder clearance width"),
      ladderArcClearanceCm: normalizeMeasurement(input.details.ladderArcClearanceCm, "Ladder arc clearance"),
      ladderArcType: normalizeOptionalText(input.details.ladderArcType, 100, "Ladder arc type"),
      planNotes: normalizeOptionalText(input.details.planNotes, 4_000, "Plan"),
      additionalInfo: normalizeOptionalText(input.details.additionalInfo, 4_000, "Additional information")
    } : undefined
  };
}

export function validateInstallationSubmission(input: InstallationSubmission): InstallationSubmission {
  if (!["accepted", "declined", "reschedule_requested"].includes(input.response)) {
    throw new Error("Invalid installation response.");
  }
  return {
    ...input,
    reason: normalizeOptionalText(input.reason, 2_000, "Installation reason")
  };
}

export function validateSelectedProducts(
  selectedProductIds: readonly string[],
  allowedProducts: readonly ProductOption[]
): ProductOption[] {
  const selected = new Set(selectedProductIds.map(normalizeGuid));
  const allowed = new Map(allowedProducts.map(product => [normalizeGuid(product.productId), product]));
  for (const id of selected) {
    if (!allowed.has(id)) throw new Error(`Product ${id} is not allowed for this survey snapshot.`);
  }
  return [...selected].map(id => allowed.get(id)!);
}

export function validateProductSelections(
  selections: readonly SurveyProductSelection[],
  allowedProducts: readonly ProductOption[]
): SurveyProductSelectionSnapshot[] {
  const allowed = new Map(allowedProducts.map(product => [normalizeGuid(product.productId), product]));
  const seen = new Set<string>();

  return selections.map(selection => {
    const productId = normalizeGuid(selection.productId);
    if (seen.has(productId)) throw new Error(`Product ${productId} was submitted more than once.`);
    seen.add(productId);

    const product = allowed.get(productId);
    if (!product) throw new Error(`Product ${productId} is not allowed for this survey snapshot.`);
    if (!Number.isFinite(selection.quantity) || selection.quantity <= 0 || selection.quantity > 100_000) {
      throw new Error(`Product ${productId} has an invalid quantity.`);
    }
    const quantity = round(selection.quantity, 3);
    if (Math.abs(quantity - selection.quantity) > 0.000_000_1) {
      throw new Error(`Product ${productId} quantity supports at most three decimal places.`);
    }
    const note = selection.note?.trim();
    if (note && note.length > 500) throw new Error(`Product ${productId} note is too long.`);

    return {
      productId,
      quantity,
      note: note || undefined,
      name: product.name,
      unitId: product.unitId,
      unitName: product.unitName,
      unitPrice: product.price,
      lineNet: roundMoney(product.price * quantity),
      priceDisplayText: product.priceDisplayText,
      priceIsIndicative: product.priceIsIndicative ?? false
    };
  });
}

export function normalizeGuid(value: string): string {
  const normalized = value.trim().replace(/[{}]/g, "").toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`Invalid GUID: ${value}`);
  }
  return normalized;
}

export function splitProductIds(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return [...new Set(value.split(",").map(item => normalizeGuid(item)))];
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundMoney(value: number): number {
  return round(value, 2);
}

function normalizeOptionalText(value: string | undefined, maximumLength: number, label: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > maximumLength) throw new Error(`${label} is too long.`);
  return normalized;
}

function normalizeMeasurement(value: number | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0 || value > 100_000) throw new Error(`${label} is invalid.`);
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function normalizeDate(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error("Quotation date is invalid.");
  return normalized;
}
