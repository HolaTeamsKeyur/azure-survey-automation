@description('Globally unique Static Web App name')
param staticWebAppName string

@description('Azure region supported by Static Web Apps')
param location string = 'westeurope'

@description('HolaTeams Dataverse organisation URL')
param dataverseUrl string

@description('Approved Microsoft 365 sender mailbox')
param graphSenderMailbox string

@description('Microsoft Entra tenant ID')
param azureTenantId string

@description('Microsoft Entra application/client ID used for Dataverse and Graph S2S')
param azureClientId string

@secure()
@description('Demonstration client secret. Prefer a certificate/managed identity for production.')
param azureClientSecret string

@secure()
@description('At least 32 random characters used to sign customer links')
param surveyTokenSecret string

@secure()
@description('At least 24 random characters protecting Dataverse trigger endpoints')
param automationIngressKey string

@description('Enable Outlook Actionable Messages only after test-provider registration')
param enableActionableMessages bool = false

@description('Actionable Messages Entra API audience; ignored when disabled')
param actionableAppIdUri string = 'disabled'

@description('Actionable Messages Originator ID; ignored when disabled')
param actionableOriginatorId string = 'disabled'

@description('Comma-separated tenant IDs permitted to submit Outlook actions')
param actionableAllowedTenants string = ''

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

resource apiSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'functionappsettings'
  kind: 'config'
  properties: {
    DATAVERSE_URL: dataverseUrl
    GRAPH_SENDER_MAILBOX: graphSenderMailbox
    PUBLIC_BASE_URL: 'https://${staticWebApp.properties.defaultHostname}'
    AZURE_TENANT_ID: azureTenantId
    AZURE_CLIENT_ID: azureClientId
    AZURE_CLIENT_SECRET: azureClientSecret
    SURVEY_TOKEN_SECRET: surveyTokenSecret
    AUTOMATION_INGRESS_KEY: automationIngressKey
    ENABLE_ACTIONABLE_MESSAGES: string(enableActionableMessages)
    REQUIRE_SURVEYOR_AUTH: 'true'
    SURVEYOR_ACCESS_MODE: 'tenant'
    ENABLE_NEW_PRODUCT_REQUESTS: 'false'
    ENABLE_DATAVERSE_SURVEY_LAYOUT: 'false'
    ENABLE_AUTO_SCHEDULING: 'false'
    ACTIONABLE_APP_ID_URI: actionableAppIdUri
    ACTIONABLE_ORIGINATOR_ID: actionableOriginatorId
    ACTIONABLE_ALLOWED_TENANTS: actionableAllowedTenants
    ACTIONABLE_ALLOW_GLOBAL_TENANTS: 'false'
    ENABLE_WORD_DOCUMENT: 'false'
    TEMPLATE_STORAGE_URL: ''
    TEMPLATE_CONTAINER: 'document-templates'
    SURVEY_TEMPLATE_BLOB: 'survey/survey-template.docx'
    DEFAULT_SURVEY_DURATION_MINUTES: '60'
    SURVEY_BUSINESS_START_HOUR: '9'
    SURVEY_BUSINESS_END_HOUR: '17'
    DEFAULT_TIME_ZONE: 'Europe/London'
  }
}

output staticWebAppId string = staticWebApp.id
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output publicUrl string = 'https://${staticWebApp.properties.defaultHostname}'
