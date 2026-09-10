import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";
import type {
  InstallationContext,
  InstallationSession,
  InstallationSubmission,
  OpportunityContext,
  ProductOption,
  SurveySession,
  SurveySessionStatus
} from "../domain/models.js";
import { normalizeGuid } from "../domain/rules.js";

export class DataverseClient {
  constructor(
    private readonly baseUrl: string,
    private readonly credential: TokenCredential = new DefaultAzureCredential()
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const access = await this.credential.getToken(`${this.baseUrl}/.default`);
    if (!access) throw new Error("Unable to obtain a Dataverse access token.");
    const response = await fetch(`${this.baseUrl}/api/data/v9.2/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${access.token}`,
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      throw new Error(`Dataverse ${init.method ?? "GET"} ${path} failed (${response.status}): ${await response.text()}`);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  async getOpportunityContext(opportunityId: string): Promise<OpportunityContext> {
    const id = normalizeGuid(opportunityId);
    const row = await this.request<Record<string, unknown>>(
      `opportunities(${id})?$select=opportunityid,name,ht_propertypostcode,ht_streetname,_parentcontactid_value,_ht_region_value,_pricelevelid_value,_ht_surveyor_value&` +
      `$expand=parentcontactid($select=contactid,fullname,emailaddress1,mobilephone),ht_Region($select=ht_regionid,ht_name,ht_regioncode,ht_email,ht_telephone,_ht_franchise_value)`
    );
    const contact = row.parentcontactid as Record<string, unknown> | undefined;
    const region = row.ht_Region as Record<string, unknown> | undefined;
    if (!contact?.contactid || !contact.emailaddress1) throw new Error("Opportunity requires a Contact with an email address.");
    if (!region?.ht_regionid) throw new Error("Opportunity requires a Region.");

    let priceListId = stringOrUndefined(row._pricelevelid_value);
    const franchiseId = stringOrUndefined(region._ht_franchise_value);
    if (!priceListId && franchiseId) {
      const account = await this.request<Record<string, unknown>>(
        `accounts(${normalizeGuid(franchiseId)})?$select=_defaultpricelevelid_value`
      );
      priceListId = stringOrUndefined(account._defaultpricelevelid_value);
    }
    const surveyorUserId = stringOrUndefined(row._ht_surveyor_value);
    let surveyorMailbox: string | undefined;
    if (surveyorUserId) {
      const surveyor = await this.request<Record<string, unknown>>(
        `systemusers(${normalizeGuid(surveyorUserId)})?$select=internalemailaddress`
      );
      surveyorMailbox = stringOrUndefined(surveyor.internalemailaddress);
    }

    return {
      opportunityId: id,
      name: String(row.name ?? "Survey"),
      propertyPostcode: stringOrUndefined(row.ht_propertypostcode),
      streetName: stringOrUndefined(row.ht_streetname),
      priceListId,
      surveyorUserId,
      customer: {
        contactId: String(contact.contactid),
        name: String(contact.fullname ?? "Customer"),
        email: String(contact.emailaddress1),
        mobile: stringOrUndefined(contact.mobilephone)
      },
      region: {
        id: String(region.ht_regionid),
        name: String(region.ht_name ?? "Region"),
        code: stringOrUndefined(region.ht_regioncode),
        telephone: stringOrUndefined(region.ht_telephone),
        senderMailbox: String(region.ht_email ?? ""),
        timeZone: "Europe/London",
        surveyDurationMinutes: 60,
        businessDayStartHour: 9,
        businessDayEndHour: 17,
        autoScheduleEnabled: true,
        surveyorUserId,
        surveyorMailbox
      }
    };
  }

  async getRegionProducts(priceListId: string): Promise<ProductOption[]> {
    const id = normalizeGuid(priceListId);
    const result = await this.request<{ value: Array<Record<string, unknown>> }>(
      `productpricelevels?$select=productpricelevelid,amount,_productid_value,_uomid_value,ht_surveydisplayorder,ht_surveycustomerdescription,ht_surveypricedisplaytext,ht_surveypriceisindicative&` +
      `$expand=productid($select=productid,name,description),uomid($select=uomid,name)&` +
      `$filter=_pricelevelid_value eq ${id} and statecode eq 0 and ht_showincustomersurvey eq true&` +
      `$orderby=ht_surveydisplayorder asc`
    );
    return result.value.map((row, index) => {
      const product = row.productid as Record<string, unknown> | undefined;
      const unit = row.uomid as Record<string, unknown> | undefined;
      return {
        priceListItemId: String(row.productpricelevelid),
        productId: String(row._productid_value),
        unitId: String(row._uomid_value),
        unitName: stringOrUndefined(unit?.name),
        name: String(product?.name ?? "Product"),
        description: stringOrUndefined(row.ht_surveycustomerdescription) ?? stringOrUndefined(product?.description),
        quantity: 1,
        price: numberOr(row.amount, 0),
        priceDisplayText: stringOrUndefined(row.ht_surveypricedisplaytext),
        priceIsIndicative: Boolean(row.ht_surveypriceisindicative),
        vatRate: undefined,
        selectedByDefault: false,
        sortOrder: numberOr(row.ht_surveydisplayorder, index + 1)
      };
    });
  }

  async findOpenSession(opportunityId: string): Promise<SurveySession | undefined> {
    const session = await this.getSession(opportunityId);
    return session.tokenId ? session : undefined;
  }

  async createSession(input: Omit<SurveySession, "id" | "version">): Promise<SurveySession> {
    const id = normalizeGuid(input.opportunityId);
    await this.request(`opportunities(${id})`, {
      method: "PATCH",
      body: JSON.stringify({
        ht_surveystart: input.scheduledStart,
        ht_surveyfinish: input.scheduledEnd,
        ht_surveyrecipientemail: input.recipientEmail,
        ht_surveyexpiresat: input.expiresAt,
        ht_surveyautomationstatuskey: input.status,
        ht_surveyallowedproductids: input.allowedProductIds.join(","),
        ht_surveyproductssnapshotjson: JSON.stringify(input.productsSnapshot),
        ht_surveyselectedproductids: input.selectedProductIds.join(","),
        ht_surveyselectionsnapshotjson: JSON.stringify(input.selectionSnapshot),
        ht_surveyproductreviewstatuskey: "not_received",
        ht_surveytokenid: input.tokenId
      })
    });
    return this.getSession(id);
  }

  async updateSession(sessionId: string, patch: Record<string, unknown>, expectedVersion?: number): Promise<void> {
    const headers: Record<string, string> = {};
    if (expectedVersion) headers["If-Match"] = `W/\"${expectedVersion}\"`;
    await this.request(`opportunities(${normalizeGuid(sessionId)})`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch)
    });
  }

  async setSessionStatus(sessionId: string, status: SurveySessionStatus, expectedVersion?: number): Promise<void> {
    await this.updateSession(sessionId, { ht_surveyautomationstatuskey: status }, expectedVersion);
  }

  async getSession(sessionId: string): Promise<SurveySession> {
    const id = normalizeGuid(sessionId);
    const row = await this.request<Record<string, unknown>>(
      `opportunities(${id})?$select=opportunityid,ht_surveyautomationstatuskey,ht_surveystart,ht_surveyfinish,ht_surveyexpiresat,ht_surveyallowedproductids,ht_surveyproductssnapshotjson,ht_surveyselectedproductids,ht_surveyselectionsnapshotjson,ht_surveytokenid,ht_surveyrecipientemail,versionnumber,_ht_region_value`
    );
    return mapOpportunitySession(row);
  }

  async createSurveyAppointment(context: OpportunityContext, start: string, end: string): Promise<string> {
    if (!context.surveyorUserId) throw new Error("A Surveyor is required for automatic scheduling.");
    const body = {
      subject: `Survey - ${context.name}`,
      scheduledstart: start,
      scheduledend: end,
      location: [context.streetName, context.propertyPostcode].filter(Boolean).join(", "),
      "regardingobjectid_opportunity@odata.bind": `/opportunities(${normalizeGuid(context.opportunityId)})`,
      appointment_activity_parties: [
        { participationtypemask: 7, "partyid_systemuser@odata.bind": `/systemusers(${normalizeGuid(context.surveyorUserId)})` },
        { participationtypemask: 5, "partyid_contact@odata.bind": `/contacts(${normalizeGuid(context.customer.contactId)})` }
      ]
    };
    const created = await this.request<Record<string, unknown>>("appointments?$select=activityid", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    await this.request(`opportunities(${normalizeGuid(context.opportunityId)})`, {
      method: "PATCH",
      body: JSON.stringify({ ht_surveystart: start, ht_surveyfinish: end })
    });
    return String(created.activityid);
  }

  async getInstallationContext(orderId: string): Promise<InstallationContext> {
    const id = normalizeGuid(orderId);
    const row = await this.request<Record<string, unknown>>(
      `salesorders(${id})?$select=salesorderid,name,ht_installationstart,ht_installationfinish,_ht_customercontact_value,_ht_region_value&` +
      `$expand=ht_CustomerContact($select=fullname,emailaddress1),ht_Region($select=ht_email)`
    );
    const contact = row.ht_CustomerContact as Record<string, unknown> | undefined;
    const region = row.ht_Region as Record<string, unknown> | undefined;
    if (!row.ht_installationstart || !row.ht_installationfinish) {
      throw new Error("Order Confirmation requires installation start and finish.");
    }
    if (!contact?.emailaddress1) throw new Error("Order Confirmation requires a Customer Contact with email.");
    return {
      orderId: id,
      orderName: String(row.name ?? "Installation"),
      scheduledStart: String(row.ht_installationstart),
      scheduledEnd: String(row.ht_installationfinish),
      recipientName: String(contact.fullname ?? "Customer"),
      recipientEmail: String(contact.emailaddress1),
      senderMailbox: String(region?.ht_email ?? "")
    };
  }

  async findOpenInstallationSession(orderId: string): Promise<InstallationSession | undefined> {
    const session = await this.getInstallationSession(orderId);
    return session.tokenId ? session : undefined;
  }

  async createInstallationSession(input: Omit<InstallationSession, "id" | "version">): Promise<InstallationSession> {
    const id = normalizeGuid(input.orderId);
    await this.request(`salesorders(${id})`, {
      method: "PATCH",
      body: JSON.stringify({
        ht_installationrecipientemail: input.recipientEmail,
        ht_installationresponseexpiresat: input.expiresAt,
        ht_installationresponsekey: input.status,
        ht_installationresponsetokenid: input.tokenId
      })
    });
    return this.getInstallationSession(id);
  }

  async getInstallationSession(sessionId: string): Promise<InstallationSession> {
    const id = normalizeGuid(sessionId);
    const row = await this.request<Record<string, unknown>>(
      `salesorders(${id})?$select=salesorderid,ht_installationresponsekey,ht_installationstart,ht_installationfinish,ht_installationresponseexpiresat,ht_installationresponsetokenid,ht_installationrecipientemail,versionnumber`
    );
    return mapOrderSession(row);
  }

  async setInstallationSessionStatus(sessionId: string, status: InstallationSession["status"], expectedVersion?: number): Promise<void> {
    const headers: Record<string, string> = {};
    if (expectedVersion) headers["If-Match"] = `W/\"${expectedVersion}\"`;
    await this.request(`salesorders(${normalizeGuid(sessionId)})`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ ht_installationresponsekey: status })
    });
  }

  async updateInstallationResponse(session: InstallationSession, submission: InstallationSubmission): Promise<void> {
    await this.request(`salesorders(${normalizeGuid(session.orderId)})`, {
      method: "PATCH",
      headers: { "If-Match": `W/\"${session.version}\"` },
      body: JSON.stringify({
        ht_installationresponsekey: submission.response,
        ht_installationresponsereason: submission.reason ?? null,
        ht_installationrespondedon: new Date().toISOString()
      })
    });
  }
}

function mapOpportunitySession(row: Record<string, unknown>): SurveySession {
  const opportunityId = String(row.opportunityid);
  return {
    id: opportunityId,
    opportunityId,
    recipientEmail: String(row.ht_surveyrecipientemail ?? ""),
    regionId: String(row._ht_region_value ?? ""),
    scheduledStart: String(row.ht_surveystart ?? ""),
    scheduledEnd: String(row.ht_surveyfinish ?? ""),
    expiresAt: String(row.ht_surveyexpiresat ?? ""),
    status: String(row.ht_surveyautomationstatuskey ?? "draft") as SurveySessionStatus,
    allowedProductIds: splitIds(row.ht_surveyallowedproductids),
    productsSnapshot: parseProductSnapshot(row.ht_surveyproductssnapshotjson),
    selectedProductIds: splitIds(row.ht_surveyselectedproductids),
    selectionSnapshot: parseSelectionSnapshot(row.ht_surveyselectionsnapshotjson),
    tokenId: String(row.ht_surveytokenid ?? ""),
    version: Number(row.versionnumber ?? 1)
  };
}

function mapOrderSession(row: Record<string, unknown>): InstallationSession {
  const orderId = String(row.salesorderid);
  return {
    id: orderId,
    orderId,
    recipientEmail: String(row.ht_installationrecipientemail ?? ""),
    scheduledStart: String(row.ht_installationstart ?? ""),
    scheduledEnd: String(row.ht_installationfinish ?? ""),
    expiresAt: String(row.ht_installationresponseexpiresat ?? ""),
    status: String(row.ht_installationresponsekey ?? "draft") as InstallationSession["status"],
    tokenId: String(row.ht_installationresponsetokenid ?? ""),
    version: Number(row.versionnumber ?? 1)
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return value === null || value === undefined || value === "" ? undefined : String(value);
}
function numberOr(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function splitIds(value: unknown): string[] {
  return String(value ?? "").split(",").map(item => item.trim()).filter(Boolean);
}
function parseProductSnapshot(value: unknown): ProductOption[] {
  if (!value) return [];
  const parsed = JSON.parse(String(value)) as ProductOption[];
  if (!Array.isArray(parsed)) throw new Error("Survey product snapshot is invalid.");
  return parsed;
}

function parseSelectionSnapshot(value: unknown): SurveySession["selectionSnapshot"] {
  if (!value) return [];
  const parsed = JSON.parse(String(value)) as SurveySession["selectionSnapshot"];
  if (!Array.isArray(parsed)) throw new Error("Survey selection snapshot is invalid.");
  return parsed;
}
