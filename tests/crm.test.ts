import { describe, expect, it } from "vitest"
import {
  CRM_PROVIDERS,
  pickWritableData,
  supportedModels,
  writableFields,
} from "@/lib/crm"

describe("CRM provider contract", () => {
  it("keeps the public starter aligned with all four connectors", () => {
    expect(CRM_PROVIDERS.map((provider) => provider.id)).toEqual([
      "hubspot",
      "salesforce",
      "pipedrive",
      "zoho_crm",
    ])
  })

  it("exposes Contact for every provider and Account only where implemented", () => {
    for (const provider of CRM_PROVIDERS) {
      expect(supportedModels(provider.id)).toContain("Contact")
    }
    expect(supportedModels("hubspot")).toContain("Account")
    expect(supportedModels("pipedrive")).toContain("Account")
    expect(supportedModels("salesforce")).not.toContain("Account")
    expect(supportedModels("zoho_crm")).not.toContain("Account")
  })

  it("allows only provider-mapped write fields", () => {
    expect(writableFields("hubspot", "Contact")).toContain("owner")
    expect(writableFields("salesforce", "Contact")).toContain("account")
    expect(writableFields("pipedrive", "Account")).toEqual(["name", "owner"])
    expect(writableFields("zoho_crm", "Account")).toEqual([])
  })

  it("filters materialized data to the provider write contract", () => {
    expect(
      pickWritableData("hubspot", "Contact", {
        first_name: "Ada",
        email: "ada@example.com",
        provider_internal_id: "never-write-this",
      }),
    ).toEqual({
      first_name: "Ada",
      email: "ada@example.com",
    })
  })
})