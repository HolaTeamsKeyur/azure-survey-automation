import { z } from "zod";

const schema = z.object({
  DATAVERSE_URL: z.string().url(),
  GRAPH_SENDER_MAILBOX: z.string().email(),
  PUBLIC_BASE_URL: z.string().url(),
  SURVEY_TOKEN_SECRET: z.string().min(32),
  AUTOMATION_INGRESS_KEY: z.string().min(24),
  SEND_SURVEY_EMAIL: z.enum(["true", "false"]).default("true"),
  CREATE_QUOTE_ON_SUBMIT: z.enum(["true", "false"]).default("true"),
  ENABLE_AUTO_SCHEDULING: z.enum(["true", "false"]).default("true"),
  ENABLE_ACTIONABLE_MESSAGES: z.enum(["true", "false"]).default("false"),
  ACTIONABLE_APP_ID_URI: z.string().default("disabled"),
  ACTIONABLE_ORIGINATOR_ID: z.string().default("disabled"),
  ACTIONABLE_ALLOWED_TENANTS: z.string().default(""),
  ACTIONABLE_ALLOW_GLOBAL_TENANTS: z.enum(["true", "false"]).default("false"),
  ENABLE_WORD_DOCUMENT: z.enum(["true", "false"]).default("false"),
  TEMPLATE_STORAGE_URL: z.union([z.string().url(), z.literal("")]).default(""),
  TEMPLATE_CONTAINER: z.string().default("document-templates"),
  SURVEY_TEMPLATE_BLOB: z.string().default("survey/survey-template.docx"),
  DEFAULT_SURVEY_DURATION_MINUTES: z.coerce.number().int().min(15).max(480).default(60),
  SURVEY_BUSINESS_START_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  SURVEY_BUSINESS_END_HOUR: z.coerce.number().int().min(1).max(24).default(17),
  DEFAULT_TIME_ZONE: z.string().default("Europe/London")
}).superRefine((value, context) => {
  if (value.SURVEY_BUSINESS_END_HOUR <= value.SURVEY_BUSINESS_START_HOUR) {
    context.addIssue({ code: "custom", path: ["SURVEY_BUSINESS_END_HOUR"], message: "Business end hour must be after business start hour." });
  }
  if (value.ENABLE_WORD_DOCUMENT === "true" && !value.TEMPLATE_STORAGE_URL) {
    context.addIssue({ code: "custom", path: ["TEMPLATE_STORAGE_URL"], message: "Template storage URL is required when Word generation is enabled." });
  }
  if (value.ENABLE_ACTIONABLE_MESSAGES === "true") {
    if (!value.ACTIONABLE_APP_ID_URI.startsWith("api://") || value.ACTIONABLE_APP_ID_URI.includes("REPLACE")) {
      context.addIssue({ code: "custom", path: ["ACTIONABLE_APP_ID_URI"], message: "A registered Actionable Messages API application ID URI is required." });
    }
    if (!z.string().uuid().safeParse(value.ACTIONABLE_ORIGINATOR_ID).success) {
      context.addIssue({ code: "custom", path: ["ACTIONABLE_ORIGINATOR_ID"], message: "A registered Actionable Messages originator ID is required." });
    }
    const permittedTenants = value.ACTIONABLE_ALLOWED_TENANTS.split(",").map(item => item.trim()).filter(Boolean);
    if (!value.ACTIONABLE_ALLOW_GLOBAL_TENANTS && permittedTenants.length === 0) {
      context.addIssue({ code: "custom", path: ["ACTIONABLE_ALLOWED_TENANTS"], message: "At least one allowed tenant is required unless global tenants are explicitly enabled." });
    }
    for (const tenantId of permittedTenants) {
      if (!z.string().uuid().safeParse(tenantId).success) {
        context.addIssue({ code: "custom", path: ["ACTIONABLE_ALLOWED_TENANTS"], message: `Invalid allowed tenant ID: ${tenantId}.` });
      }
    }
  }
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = schema.parse(env);
  return {
    ...value,
    dataverseUrl: value.DATAVERSE_URL.replace(/\/$/, ""),
    publicBaseUrl: value.PUBLIC_BASE_URL.replace(/\/$/, ""),
    sendSurveyEmail: value.SEND_SURVEY_EMAIL === "true",
    createQuoteOnSubmit: value.CREATE_QUOTE_ON_SUBMIT === "true",
    enableAutoScheduling: value.ENABLE_AUTO_SCHEDULING === "true",
    actionableAllowedTenants: value.ACTIONABLE_ALLOWED_TENANTS.split(",").map(x => x.trim().toLowerCase()).filter(Boolean),
    actionableAllowGlobalTenants: value.ACTIONABLE_ALLOW_GLOBAL_TENANTS === "true",
    enableActionableMessages: value.ENABLE_ACTIONABLE_MESSAGES === "true",
    enableWordDocument: value.ENABLE_WORD_DOCUMENT === "true"
  };
}
