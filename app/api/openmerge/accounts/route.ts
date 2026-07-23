import { NextResponse } from "next/server"
import { failure, objectBody, stringArrayField, stringField } from "@/lib/http"
import { supportedModels } from "@/lib/crm"
import { openmerge, workspaceId } from "@/lib/openmerge"

export async function GET(request: Request) {
  try {
    return NextResponse.json(
      await openmerge().linkedAccounts.list(workspaceId(), {
        signal: request.signal,
      }),
    )
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await objectBody(request)
    const linkedAccountId = stringField(body, "linkedAccountId")
    const account = await openmerge().linkedAccounts.get(linkedAccountId, {
      signal: request.signal,
    })
    const requestedModels = stringArrayField(body, "models")
    const allowedModels = supportedModels(account.provider)
    const models = requestedModels?.length
      ? requestedModels.filter((model) => allowedModels.includes(model as never))
      : undefined

    if (requestedModels?.length && models?.length !== requestedModels.length) {
      throw new TypeError(
        `Supported models for ${account.provider}: ${allowedModels.join(", ")}`,
      )
    }

    const runs = await openmerge().linkedAccounts.sync(
      linkedAccountId,
      models,
      { signal: request.signal },
    )
    return NextResponse.json({ runs, acceptedAt: Date.now() }, { status: 202 })
  } catch (error) {
    return failure(error)
  }
}