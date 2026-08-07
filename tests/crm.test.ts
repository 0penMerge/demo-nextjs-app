import { describe, expect, it } from "vitest"
import type { DemoCatalog } from "@/lib/catalog-types"
import {
  pickWritableData,
  providerDefinition,
  supportedModels,
  writableFields,
} from "@/lib/catalog-types"

const catalog: DemoCatalog = {
  providers: [
    {
      id: "connector_x",
      name: "Connector X",
      mark: "CX",
      description: "Installed from a connector bundle",
      models: ["Contact", "CustomObject"],
    },
  ],
  models: [
    {
      id: "Contact",
      fields: ["email", "first_name", "provider_internal_id"],
      writableByProvider: { connector_x: ["email", "first_name"] },
    },
    {
      id: "CustomObject",
      fields: ["name"],
      writableByProvider: { connector_x: ["name"] },
    },
  ],
}

describe("dynamic connector catalog contract", () => {
  it("discovers providers and models without source-code constants", () => {
    expect(providerDefinition(catalog, "connector_x")?.name).toBe("Connector X")
    expect(supportedModels(catalog, "connector_x")).toEqual(["Contact", "CustomObject"])
    expect(supportedModels(catalog, "not_installed")).toEqual([])
  })

  it("uses provider-specific writable fields from model coverage", () => {
    expect(writableFields(catalog, "connector_x", "Contact")).toEqual(["email", "first_name"])
    expect(writableFields(catalog, "not_installed", "Contact")).toEqual([])
  })

  it("filters materialized data to the live provider write contract", () => {
    expect(
      pickWritableData(catalog, "connector_x", "Contact", {
        first_name: "Ada",
        email: "ada@example.com",
        provider_internal_id: "never-write-this",
      }),
    ).toEqual({
      email: "ada@example.com",
      first_name: "Ada",
    })
  })
})
