import { NextResponse } from "next/server"
import { authorizedAccount } from "@/lib/account-access"
import { requireProviderModel } from "@/lib/catalog"
import { writableFields } from "@/lib/catalog-types"
import { requireDemoSession } from "@/lib/demo-auth"
import { failure, objectBody, stringField } from "@/lib/http"
import { openmerge, workspaceId } from "@/lib/openmerge"

const TERMINAL_SUCCESS = "completed"

export async function POST(request: Request) {
  try {
    const session = requireDemoSession(request, { mutation: true })
    const body = await objectBody(request)
    const linkedAccountId = stringField(body, "linkedAccountId")
    const model = stringField(body, "model")
    const unifiedId = stringField(body, "unifiedId")
    const idempotencyKey = stringField(body, "idempotencyKey", { min: 8, max: 200 })
    const changes = body.changes
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      throw new TypeError("changes must be a non-empty object")
    }
    const changeEntries = Object.entries(changes)
    if (changeEntries.length === 0) throw new TypeError("changes must contain at least one field")

    const account = await authorizedAccount(linkedAccountId, session, request.signal)
    const catalog = await requireProviderModel(account.provider, model, request.signal)
    const allowedFields = writableFields(catalog, account.provider, model)
    const unknownFields = changeEntries.map(([field]) => field).filter((field) => !allowedFields.includes(field))
    if (unknownFields.length) {
      throw new TypeError(`Unsupported write fields: ${unknownFields.join(", ")}. Allowed: ${allowedFields.join(", ")}`)
    }

    const submitted = await openmerge().writebacks.submit(
      { workspaceId: workspaceId(), linkedAccountId, model, unifiedId, changes: changes as Record<string, unknown>, idempotencyKey },
      { signal: request.signal },
    )
    const writeback = await openmerge().writebacks.waitForTerminal(submitted.id, workspaceId(), {
      signal: request.signal, intervalMs: 750, timeoutMs: 45_000,
    })
    if (writeback.state !== TERMINAL_SUCCESS) {
      return NextResponse.json({ error: "The provider rejected or failed the writeback.", writeback }, { status: 502 })
    }
    const syncRuns = body.reconcile === false
      ? []
      : await openmerge().linkedAccounts.sync(linkedAccountId, [model], { signal: request.signal })
    return NextResponse.json({ writeback, syncRuns })
  } catch (error) {
    return failure(error)
  }
}
