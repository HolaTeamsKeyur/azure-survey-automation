import { DefaultAzureCredential, type TokenCredential } from "@azure/identity";
import type {
  InstallationContext,
  InstallationSession,
  InstallationSubmission,
  NewProductRequest,
  OpportunityContext,
  ProductOption,
  SurveyProductSelectionSnapshot,
  SurveySession,
  SurveySessionStatus
} from "../domain/models.js";
import { normalizeGuid } from "../domain/rules.js";
import { parseSurveyLayout, type SurveyLayout } from "../domain/surveyLayout.js";

const OPTIONAL_OPPORTUNITY_SURVEY_COLUMNS = [
  "ht_surveyaddress",
  "ht_surveypropertytype",
  "ht_surveypropertyage",
  "ht_surveyadvertisingsource",
  "ht_surveyexistinghatchtype",
  "ht_surveyflooringrequired",
  "ht_surveyladderrequired",
  "ht_surveylightrequired",
  "ht_surveyinsulationrequired",
  "ht_surveyotherinformation",
  "ht_quotationdate",
  "ht_surveyhousetype",
  "ht_surveyrooftype",
  "ht_surveyceilingheightcm",
  "ht_surveyhatchtopwidthcm",
  "ht_surveyhatchtoplengthcm",
  "ht_surveyhatchinsidewidthcm",
  "ht_surveyhatchinsidelengthcm",
  "ht_surveyladderclearancewidthcm",
  "ht_surveyladderarcclearancecm",
  "ht_surveyladderarctype",
  "ht_surveyplannotes",
  "ht_surveyadditionalinfo"
] as const;

const OPTIONAL_OPPORTUNITY_SURVEY_COLUMN_SET = new Set<string>(OPTIONAL_OPPORTUNITY_SURVEY_COLUMNS);

export class DataverseClient {
  private opportunitySurveyColumnsPromise?: Promise<Set<string>>;

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
        Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      throw new Error(`Dataverse ${init.method ?? "GET"} ${path} failed (${response.status}): ${await response.text()}`);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }

  private getAvailableOpportunitySurveyColumns(): Promise<Set<string>> {
    this.opportunitySurveyColumnsPromise ??= this.loadAvailableOpportunitySurveyColumns();
    return this.opportunitySurveyColumnsPromise;
  }

  private async loadAvailableOpportunitySurveyColumns(): Promise<Set<string>> {
    try {
      const result = await this.request<{ value: Array<{ LogicalName?: string }> }>(
        "EntityDefinitions(LogicalName='opportunity')/Attributes?$select=LogicalName"
      );
      return new Set(
        result.value
          .map(attribute => attribute.LogicalName?.toLowerCase())
          .filter((name): name is string =>
            typeof name === "string" && OPTIONAL_OPPORTUNITY_SURVEY_COLUMN_SET.has(name)
          )
      );
    } catch {
      // Metadata access is not essential. If the application user cannot read
      // metadata, omit the optional survey-detail columns and use legacy fields.
      return new Set<string>();
    }
  }

  private async removeUnavailableOpportunitySurveyColumns(
    patch: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const available = await this.getAvailableOpportunitySurveyColumns();
    return Object.fromEntries(
      Object.entries(patch).filter(([name]) =>
        !OPTIONAL_OPPORTUNITY_SURVEY_COLUMN_SET.has(name.toLowerCase()) || available.has(name.toLowerCase())
      )
    );
  }

  async getOpportunityContext(opportunityId: string): Promise<OpportunityContext> {
    const id = normalizeGuid(opportunityId);
    const availableSurveyColumns = await this.getAvailableOpportunitySurveyColumns();
    const optionalSelect = OPTIONAL_OPPORTUNITY_SURVEY_COLUMNS
      .filter(name => availableSurveyColumns.has(name))
      .join(",");
    const row = await this.request<Record<string, unknown>>(
      `opportunities(${id})?$select=opportunityid,name,ht_propertypostcode,ht_streetname,ht_surveystart,ht_surveyfinish,_parentcontactid_value,_ht_region_value,_pricelevelid_value,_transactioncurrencyid_value,_ht_surveyor_value,` +
      `ht_propertytype,ht_propertyage,ht_existinghatchtype,ht_loftboardingrequired,ht_loftladderrequired,ht_lightrequired,ht_insulationrequired` +
      `${optionalSelect ? `,${optionalSelect}` : ""}&` +
      `$expand=parentcontactid($select=contactid,fullname,emailaddress1,mobilephone),ht_Region($select=ht_regionid,ht_name,ht_regioncode,ht_email,ht_telephone,_ht_franchise_value)`
    );
    const contact = row.parentcontactid as Record<string, unknown> | undefined;
    const region = row.ht_Region as Record<string, unknown> | undefined;
    if (!contact?.contactid || !contact.emailaddress1) throw new Error("Opportunity requires a Contact with an email address.");
    if (!region?.ht_regionid) throw new Error("Opportunity requires a Region.");

    let priceListId = stringOrUndefined(row._pricelevelid_value);
    const franchiseId = stringOrUndefined(region._ht_franchise_value);
    const franchise = franchiseId
      ? await this.request<Record<string, unknown>>(
        `accounts(${normalizeGuid(franchiseId)})?$select=name,_defaultpricelevelid_value`
      )
      : undefined;
    if (!priceListId) priceListId = stringOrUndefined(franchise?._defaultpricelevelid_value);
    const surveyorUserId = stringOrUndefined(row._ht_surveyor_value);
    let surveyorMailbox: string | undefined;
    let surveyorName: string | undefined;
    if (surveyorUserId) {
      const surveyor = await this.request<Record<string, unknown>>(
        `systemusers(${normalizeGuid(surveyorUserId)})?$select=fullname,internalemailaddress`
      );
      surveyorMailbox = stringOrUndefined(surveyor.internalemailaddress);
      surveyorName = stringOrUndefined(surveyor.fullname);
    }

    return {
      opportunityId: id,
      name: String(row.name ?? "Survey"),
      propertyPostcode: stringOrUndefined(row.ht_propertypostcode),
      streetName: stringOrUndefined(row.ht_streetname),
      priceListId,
      currencyId: stringOrUndefined(row._transactioncurrencyid_value),
      surveyorUserId,
      scheduledStart: stringOrUndefined(row.ht_surveystart),
      scheduledEnd: stringOrUndefined(row.ht_surveyfinish),
      surveyDetails: {
        address: stringOrUndefined(row.ht_surveyaddress) ?? stringOrUndefined(row.ht_streetname),
        propertyType: stringOrUndefined(row.ht_surveypropertytype) ?? formattedOrRaw(row, "ht_propertytype"),
        propertyAge: stringOrUndefined(row.ht_surveypropertyage) ?? formattedOrRaw(row, "ht_propertyage"),
        advertisingSource: stringOrUndefined(row.ht_surveyadvertisingsource),
        existingHatchType: stringOrUndefined(row.ht_surveyexistinghatchtype) ?? formattedOrRaw(row, "ht_existinghatchtype"),
        flooringRequired: stringOrUndefined(row.ht_surveyflooringrequired) ?? formattedOrBoolean(row, "ht_loftboardingrequired"),
        ladderRequired: stringOrUndefined(row.ht_surveyladderrequired) ?? formattedOrBoolean(row, "ht_loftladderrequired"),
        lightRequired: stringOrUndefined(row.ht_surveylightrequired) ?? formattedOrRaw(row, "ht_lightrequired"),
        insulationRequired: stringOrUndefined(row.ht_surveyinsulationrequired) ?? formattedOrBoolean(row, "ht_insulationrequired"),
        otherInformation: stringOrUndefined(row.ht_surveyotherinformation),
        quotationDate: dateOnlyOrUndefined(row.ht_quotationdate),
        houseType: stringOrUndefined(row.ht_surveyhousetype),
        roofType: stringOrUndefined(row.ht_surveyrooftype),
        ceilingHeightCm: numberOrUndefined(row.ht_surveyceilingheightcm),
        hatchTopWidthCm: numberOrUndefined(row.ht_surveyhatchtopwidthcm),
        hatchTopLengthCm: numberOrUndefined(row.ht_surveyhatchtoplengthcm),
        hatchInsideWidthCm: numberOrUndefined(row.ht_surveyhatchinsidewidthcm),
        hatchInsideLengthCm: numberOrUndefined(row.ht_surveyhatchinsidelengthcm),
        ladderClearanceWidthCm: numberOrUndefined(row.ht_surveyladderclearancewidthcm),
        ladderArcClearanceCm: numberOrUndefined(row.ht_surveyladderarcclearancecm),
        ladderArcType: stringOrUndefined(row.ht_surveyladderarctype),
        planNotes: stringOrUndefined(row.ht_surveyplannotes),
        additionalInfo: stringOrUndefined(row.ht_surveyadditionalinfo)
      },
      customer: {
        contactId: String(contact.contactid),
        name: String(contact.fullname ?? "Customer"),
        email: String(contact.emailaddress1),
        mobile: stringOrUndefined(contact.mobilephone)
      },
      region: {
        id: String(region.ht_regionid),
        name: String(region.ht_name ?? "Region"),
        franchiseId,
        franchiseName: stringOrUndefined(franchise?.name),
        code: stringOrUndefined(region.ht_regioncode),
        telephone: stringOrUndefined(region.ht_telephone),
        senderMailbox: String(region.ht_email ?? ""),
        timeZone: "Europe/London",
        surveyDurationMinutes: 60,
        businessDayStartHour: 9,
        businessDayEndHour: 17,
        autoScheduleEnabled: true,
        surveyorUserId,
        surveyorMailbox,
        surveyorName
      }
    };
  }

  async getRegionProducts(priceListId: string): Promise<ProductOption[]> {
    const id = normalizeGuid(priceListId);
    const result = await this.request<{ value: Array<Record<string, unknown>> }>(
      `productpricelevels?$select=productpricelevelid,amount,_productid_value,_uomid_value,ht_surveydisplayorder,ht_surveycustomerdescription,ht_surveypricedisplaytext,ht_surveypriceisindicative&` +
      `$expand=productid($select=productid,name,description),uomid($select=uomid,name)&` +
      `$filter=_pricelevelid_value eq ${id} and ht_showincustomersurvey eq true&` +
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

  async applyOpportunityPriceList(opportunityId: string, priceListId: string): Promise<string | undefined> {
    const opportunity = normalizeGuid(opportunityId);
    const priceList = normalizeGuid(priceListId);
    const [opportunityRow, priceListRow] = await Promise.all([
      this.request<Record<string, unknown>>(
        `opportunities(${opportunity})?$select=_pricelevelid_value,_transactioncurrencyid_value`
      ),
      this.request<Record<string, unknown>>(
        `pricelevels(${priceList})?$select=_transactioncurrencyid_value`
      )
    ]);
    const currencyId = stringOrUndefined(priceListRow._transactioncurrencyid_value);
    const patch: Record<string, unknown> = {};
    if (String(opportunityRow._pricelevelid_value ?? "").toLowerCase() !== priceList) {
      patch["pricelevelid@odata.bind"] = `/pricelevels(${priceList})`;
    }
    if (currencyId && String(opportunityRow._transactioncurrencyid_value ?? "").toLowerCase() !== currencyId.toLowerCase()) {
      patch["transactioncurrencyid@odata.bind"] = `/transactioncurrencies(${normalizeGuid(currencyId)})`;
    }
    if (Object.keys(patch).length) {
      await this.request(`opportunities(${opportunity})`, { method: "PATCH", body: JSON.stringify(patch) });
    }
    return currencyId;
  }

  async upsertOpportunityProducts(opportunityId: string, selections: readonly SurveyProductSelectionSnapshot[]): Promise<void> {
    const opportunity = normalizeGuid(opportunityId);
    const existing = await this.request<{ value: Array<Record<string, unknown>> }>(
      `opportunityproducts?$select=opportunityproductid,_productid_value&$filter=_opportunityid_value eq ${opportunity}`
    );
    const byProduct = new Map(existing.value.map(row => [String(row._productid_value).toLowerCase(), String(row.opportunityproductid)]));

    for (const selection of selections) {
      const productId = normalizeGuid(selection.productId);
      const body = {
        quantity: selection.quantity,
        ispriceoverridden: true,
        priceperunit: selection.unitPrice
      };
      const existingId = byProduct.get(productId);
      if (existingId) {
        await this.request(`opportunityproducts(${normalizeGuid(existingId)})`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await this.request("opportunityproducts", {
          method: "POST",
          body: JSON.stringify({
            ...body,
            "opportunityid@odata.bind": `/opportunities(${opportunity})`,
            "productid@odata.bind": `/products(${productId})`,
            "uomid@odata.bind": `/uoms(${normalizeGuid(selection.unitId)})`
          })
        });
      }
    }
  }

  async createNewProductRequests(
    opportunityId: string,
    surveyorUserId: string,
    currencyId: string | undefined,
    requests: readonly NewProductRequest[]
  ): Promise<void> {
    const opportunity = normalizeGuid(opportunityId);
    const surveyor = normalizeGuid(surveyorUserId);
    for (const [index, request] of requests.entries()) {
      const sourceKey = `${opportunity}:${index + 1}`;
      await this.request(`ht_surveyproductrequests(ht_sourcekey='${sourceKey}')`, {
        method: "PATCH",
        body: JSON.stringify({
          ht_sourcekey: sourceKey,
          ht_name: request.name,
          ht_description: request.description ?? null,
          ht_quantity: request.quantity,
          ht_unitname: request.unitName ?? null,
          ht_estimatedunitprice: request.estimatedUnitPrice ?? null,
          ht_justification: request.justification ?? null,
          ht_statuskey: "pending",
          "ht_Opportunity@odata.bind": `/opportunities(${opportunity})`,
          "ht_Surveyor@odata.bind": `/systemusers(${surveyor})`,
          ...(currencyId ? { "transactioncurrencyid@odata.bind": `/transactioncurrencies(${normalizeGuid(currencyId)})` } : {})
        })
      });
    }
  }

  async getSurveyLayout(regionId: string): Promise<SurveyLayout | undefined> {
    const region = normalizeGuid(regionId);
    const select = "$select=ht_surveytemplateid,ht_name,ht_definitionjson,ht_version,ht_isdefault,modifiedon";
    const regional = await this.request<{ value: Array<Record<string, unknown>> }>(
      `ht_surveytemplates?${select}&$filter=statecode eq 0 and _ht_region_value eq ${region}&$orderby=modifiedon desc&$top=1`
    );
    const row = regional.value[0] ?? (await this.request<{ value: Array<Record<string, unknown>> }>(
      `ht_surveytemplates?${select}&$filter=statecode eq 0 and ht_isdefault eq true&$orderby=modifiedon desc&$top=1`
    )).value[0];
    const definition = stringOrUndefined(row?.ht_definitionjson);
    return definition ? parseSurveyLayout(definition) : undefined;
  }

  async generateQuoteFromOpportunity(opportunityId: string): Promise<{ quoteId: string; reused: boolean }> {
    const opportunity = normalizeGuid(opportunityId);
    const existing = await this.request<{ value: Array<Record<string, unknown>> }>(
      `quotes?$select=quoteid,createdon&$filter=_opportunityid_value eq ${opportunity}&$orderby=createdon desc&$top=1`
    );
    const existingId = stringOrUndefined(existing.value[0]?.quoteid);
    if (existingId) return { quoteId: normalizeGuid(existingId), reused: true };

    const generated = await this.request<Record<string, unknown>>("GenerateQuoteFromOpportunity", {
      method: "POST",
      body: JSON.stringify({
        OpportunityId: opportunity,
        ColumnSet: {
          AllColumns: false,
          Columns: ["quoteid", "name", "opportunityid", "customerid", "pricelevelid"]
        }
      })
    });
    const containers = [generated, generated.Entity, generated.entity, generated.Quote]
      .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object") as Array<Record<string, unknown>>;
    for (const container of containers) {
      const quoteId = stringOrUndefined(container.quoteid) ?? stringOrUndefined(container.QuoteId);
      if (quoteId) return { quoteId: normalizeGuid(quoteId), reused: false };
    }

    const created = await this.request<{ value: Array<Record<string, unknown>> }>(
      `quotes?$select=quoteid,createdon&$filter=_opportunityid_value eq ${opportunity}&$orderby=createdon desc&$top=1`
    );
    const quoteId = stringOrUndefined(created.value[0]?.quoteid);
    if (!quoteId) throw new Error("Dataverse did not return the generated Quote.");
    return { quoteId: normalizeGuid(quoteId), reused: false };
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
    const compatiblePatch = await this.removeUnavailableOpportunitySurveyColumns(patch);
    await this.request(`opportunities(${normalizeGuid(sessionId)})`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(compatiblePatch)
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
function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
function formattedOrRaw(row: Record<string, unknown>, logicalName: string): string | undefined {
  return stringOrUndefined(row[`${logicalName}@OData.Community.Display.V1.FormattedValue`])
    ?? stringOrUndefined(row[logicalName]);
}
function formattedOrBoolean(row: Record<string, unknown>, logicalName: string): string | undefined {
  const formatted = stringOrUndefined(row[`${logicalName}@OData.Community.Display.V1.FormattedValue`]);
  if (formatted) return formatted;
  const value = row[logicalName];
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return stringOrUndefined(value);
}
function dateOnlyOrUndefined(value: unknown): string | undefined {
  const result = stringOrUndefined(value);
  return result?.slice(0, 10);
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
