import { OpenMerge } from "@openmerge/core"

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the live mapping contract`)
  return value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const apiKey = required("OPENMERGE_API_KEY")
const workspaceId = required("OPENMERGE_WORKSPACE_ID")
const accountId = required("OPENMERGE_LIVE_LINKED_ACCOUNT_ID")
const oauthAppId = required("OPENMERGE_LIVE_OAUTH_APP_ID")
const model = process.env.OPENMERGE_LIVE_MODEL?.trim() || "Contact"
const expectedField = process.env.OPENMERGE_LIVE_EXPECTED_FIELD?.trim()

const client = new OpenMerge({
  apiKey,
  baseUrl: process.env.OPENMERGE_API_URL?.trim() || "https://api.openmerge.dev",
  timeoutMs: 30_000,
})

const [accounts, developerIR, mapping, records] = await Promise.all([
  client.linkedAccounts.list(workspaceId),
  client.developerIR.get(workspaceId, oauthAppId, model),
  client.connectionMappings.get(accountId),
  client.unifiedRecords.listPage(model, {
    workspaceId,
    linkedAccountId: accountId,
    pageSize: 50,
  }),
])

const account = accounts.find((candidate) => candidate.id === accountId)
assert(account, `linked account ${accountId} was not returned by the workspace`)
assert(account.wsid === workspaceId, "linked account escaped the configured workspace")
assert(developerIR.generation >= 1, "Developer IR has no persisted generation")
assert(mapping.linked_account.id === accountId, "mapping response belongs to another account")
assert(mapping.status === "active", `expected active mapping, received ${mapping.status}`)
const mappedModel = mapping.models.find((candidate) => candidate.id === model)
assert(mappedModel, `mapping response does not include ${model}`)
assert(mappedModel.schema_ready === true, "provider schema discovery is not ready")
assert(
  mappedModel.developer_ir_generation === developerIR.generation,
  "active mapping does not reference the current Developer IR generation",
)

if (expectedField) {
  const hasRequirement = Object.hasOwn(developerIR.requirements, expectedField)
  const hasDeliveredField = records.records.some((record) =>
    Object.hasOwn(record.data ?? {}, expectedField),
  )
  assert(hasRequirement, `Developer IR does not declare ${expectedField}`)
  assert(hasDeliveredField, `no materialized ${model} contains ${expectedField}`)
}

console.log(
  JSON.stringify({
    ok: true,
    provider: account.provider,
    model,
    developerIRGeneration: developerIR.generation,
    mappingStatus: mapping.status,
    providerFieldsDiscovered: mappedModel.provider_fields.length,
    recordsChecked: records.records.length,
    expectedField: expectedField || null,
  }),
)
