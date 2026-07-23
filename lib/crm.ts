export const CRM_PROVIDERS = [
  {
    id: "hubspot",
    name: "HubSpot",
    mark: "HS",
    description: "Contacts and companies",
    models: ["Contact", "Account"],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    mark: "SF",
    description: "Contacts with governed writeback",
    models: ["Contact"],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    mark: "PD",
    description: "People and organizations",
    models: ["Contact", "Account"],
  },
  {
    id: "zoho_crm",
    name: "Zoho CRM",
    mark: "ZO",
    description: "CRM contacts",
    models: ["Contact"],
  },
] as const

export type CrmProviderId = (typeof CRM_PROVIDERS)[number]["id"]
export type CrmModel = "Contact" | "Account"

export const WRITABLE_FIELDS: Record<CrmProviderId, Record<CrmModel, readonly string[]>> = {
  hubspot: {
    Contact: ["first_name", "last_name", "email", "phone", "owner"],
    Account: ["name", "description", "industry", "website", "number_of_employees", "phone", "owner"],
  },
  salesforce: {
    Contact: ["first_name", "last_name", "email", "phone", "account"],
    Account: [],
  },
  pipedrive: {
    Contact: ["first_name", "last_name", "email", "phone", "account"],
    Account: ["name", "owner"],
  },
  zoho_crm: {
    Contact: ["first_name", "last_name", "email", "phone", "account"],
    Account: [],
  },
}

export function providerDefinition(provider: string) {
  return CRM_PROVIDERS.find((candidate) => candidate.id === provider)
}

export function supportedModels(provider: string): readonly CrmModel[] {
  return providerDefinition(provider)?.models ?? ["Contact"]
}

export function writableFields(provider: string, model: CrmModel): readonly string[] {
  if (!(provider in WRITABLE_FIELDS)) return []
  return WRITABLE_FIELDS[provider as CrmProviderId][model]
}

export function pickWritableData(
  provider: string,
  model: CrmModel,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    writableFields(provider, model)
      .filter((field) => data[field] !== undefined)
      .map((field) => [field, data[field]]),
  )
}