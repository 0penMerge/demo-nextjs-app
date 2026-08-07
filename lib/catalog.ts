import "server-only"

import type { ConnectorIntegration, UnifiedModelDefinition } from "@openmerge/core"
import type { DemoCatalog, DemoCatalogProvider } from "@/lib/catalog-types"
import { openmerge, workspaceId } from "@/lib/openmerge"

function isCrmCategory(value: unknown): boolean {
  return typeof value === "string" && (value === "crm" || value.startsWith("crm@"))
}

function providerMark(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function providerModels(provider: string, models: UnifiedModelDefinition[]): string[] {
  return models
    .filter((model) => model.base_mapped_provider_ids?.includes(provider))
    .map((model) => model.id)
    .sort()
}

function normalizeProvider(
  integration: ConnectorIntegration,
  models: UnifiedModelDefinition[],
): DemoCatalogProvider {
  const name = integration.descriptor.name || integration.provider
  return {
    id: integration.provider,
    name,
    mark: providerMark(name),
    description: integration.descriptor.description || `${name} CRM integration`,
    logoUrl: integration.descriptor.logo?.url,
    models: providerModels(integration.provider, models),
  }
}

export async function crmCatalog(signal?: AbortSignal): Promise<DemoCatalog> {
  const wsid = workspaceId()
  const [integrations, allModels] = await Promise.all([
    openmerge().integrations.list(wsid, { signal }),
    openmerge().models.list(wsid, { signal }),
  ])
  const models = allModels.filter((model) => isCrmCategory(model.category))
  const providers = integrations
    .filter((integration) => integration.descriptor.categories?.some(isCrmCategory))
    .map((integration) => normalizeProvider(integration, models))
    .filter((provider) => provider.models.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    providers,
    models: models.map((model) => ({
      id: model.id,
      fields: Object.keys(model.fields ?? {}).sort(),
      writableByProvider: Object.fromEntries(
        Object.entries(model.base_two_way_field_ids_by_provider ?? {})
          .filter(([provider]) => providers.some((candidate) => candidate.id === provider))
          .map(([provider, fields]) => [provider, [...fields].sort()]),
      ),
    })),
  }
}

export async function requireProviderModel(
  provider: string,
  model: string,
  signal?: AbortSignal,
): Promise<DemoCatalog> {
  const catalog = await crmCatalog(signal)
  const definition = catalog.providers.find((candidate) => candidate.id === provider)
  if (!definition) throw new TypeError(`Provider ${provider} is not in the live CRM connector catalog`)
  if (!definition.models.includes(model)) {
    throw new TypeError(`Supported models for ${provider}: ${definition.models.join(", ")}`)
  }
  return catalog
}
