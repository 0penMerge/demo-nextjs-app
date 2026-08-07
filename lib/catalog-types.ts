export interface DemoCatalogModel {
  id: string
  fields: string[]
  writableByProvider: Record<string, string[]>
}

export interface DemoCatalogProvider {
  id: string
  name: string
  mark: string
  description: string
  logoUrl?: string
  models: string[]
}

export interface DemoCatalog {
  providers: DemoCatalogProvider[]
  models: DemoCatalogModel[]
}

export function providerDefinition(catalog: DemoCatalog, provider: string) {
  return catalog.providers.find((candidate) => candidate.id === provider)
}

export function supportedModels(catalog: DemoCatalog, provider: string): string[] {
  return providerDefinition(catalog, provider)?.models ?? []
}

export function writableFields(catalog: DemoCatalog, provider: string, model: string): string[] {
  return catalog.models.find((candidate) => candidate.id === model)?.writableByProvider[provider] ?? []
}

export function pickWritableData(
  catalog: DemoCatalog,
  provider: string,
  model: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    writableFields(catalog, provider, model)
      .filter((field) => data[field] !== undefined)
      .map((field) => [field, data[field]]),
  )
}
