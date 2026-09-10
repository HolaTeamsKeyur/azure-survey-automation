export type SurveySessionStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "reschedule_requested"
  | "expired"
  | "failed";

export type InstallationResponse = "accepted" | "declined" | "reschedule_requested";

export type InstallationSessionStatus =
  | "draft"
  | "sent"
  | InstallationResponse
  | "expired"
  | "failed";

export interface RegionContext {
  id: string;
  name: string;
  code?: string;
  telephone?: string;
  senderMailbox: string;
  timeZone: string;
  surveyDurationMinutes: number;
  businessDayStartHour: number;
  businessDayEndHour: number;
  autoScheduleEnabled: boolean;
  surveyorMailbox?: string;
  surveyorUserId?: string;
}

export interface CustomerContext {
  contactId: string;
  name: string;
  email: string;
  mobile?: string;
}

export interface OpportunityContext {
  opportunityId: string;
  name: string;
  region: RegionContext;
  customer: CustomerContext;
  propertyPostcode?: string;
  streetName?: string;
  priceListId?: string;
  surveyorUserId?: string;
}

export interface ProductOption {
  productId: string;
  priceListItemId?: string;
  name: string;
  description?: string;
  unitId: string;
  unitName?: string;
  quantity: number;
  price: number;
  priceDisplayText?: string;
  priceIsIndicative?: boolean;
  vatRate?: number;
  selectedByDefault: boolean;
  sortOrder: number;
}

export interface SurveyProductSelection {
  productId: string;
  quantity: number;
  note?: string;
}

export interface SurveyProductSelectionSnapshot extends SurveyProductSelection {
  name: string;
  unitId: string;
  unitName?: string;
  unitPrice: number;
  lineNet: number;
  priceDisplayText?: string;
  priceIsIndicative: boolean;
}

export interface SurveySession {
  id: string;
  opportunityId: string;
  recipientEmail: string;
  regionId: string;
  scheduledStart: string;
  scheduledEnd: string;
  expiresAt: string;
  status: SurveySessionStatus;
  allowedProductIds: string[];
  productsSnapshot: ProductOption[];
  selectedProductIds: string[];
  selectionSnapshot: SurveyProductSelectionSnapshot[];
  tokenId: string;
  version: number;
}

export interface SurveySubmission {
  sessionId: string;
  response: "accepted" | "declined" | "reschedule_requested";
  selectedProductIds: string[];
  productSelections?: SurveyProductSelection[];
  reason?: string;
  feedbackScore?: number;
  feedbackComments?: string;
  details?: SurveyDetails;
}

export interface SurveyDetails {
  address?: string;
  propertyType?: string;
  propertyAge?: string;
  advertisingSource?: string;
  existingHatchType?: string;
  flooringRequired?: string;
  ladderRequired?: string;
  lightRequired?: string;
  insulationRequired?: string;
  otherInformation?: string;
  quotationDate?: string;
  houseType?: string;
  roofType?: string;
  ceilingHeightCm?: number;
  hatchTopWidthCm?: number;
  hatchTopLengthCm?: number;
  hatchInsideWidthCm?: number;
  hatchInsideLengthCm?: number;
  ladderClearanceWidthCm?: number;
  ladderArcClearanceCm?: number;
  ladderArcType?: string;
  planNotes?: string;
  additionalInfo?: string;
}

export interface InstallationSubmission {
  response: InstallationResponse;
  reason?: string;
  proposedStart?: string;
  proposedEnd?: string;
}

export interface InstallationContext {
  orderId: string;
  orderName: string;
  scheduledStart: string;
  scheduledEnd: string;
  recipientName: string;
  recipientEmail: string;
  senderMailbox: string;
}

export interface InstallationSession {
  id: string;
  orderId: string;
  recipientEmail: string;
  scheduledStart: string;
  scheduledEnd: string;
  expiresAt: string;
  status: InstallationSessionStatus;
  tokenId: string;
  version: number;
}
