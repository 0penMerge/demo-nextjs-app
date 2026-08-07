import { NextResponse } from "next/server"
import { authorizedAccount } from "@/lib/account-access"
import { requireProviderModel } from "@/lib/catalog"
import { requireDemoSession } from "@/lib/demo-auth"
import { failure, objectBody, stringArrayField, stringField } from "@/lib/http"
import { openmerge, workspaceId } from "@/lib/openmerge"

export async function GET(request: Request) {
  try {
    const session = requireDemoSession(request)
    const accounts = await openmerge().linkedAccounts.list(workspaceId(), { signal: request.signal })
    return NextResponse.json(accounts.filter((account) =>
      account.wsid === workspaceId() && account.end_user_origin_id === session.endUserOriginId,
    ))
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = requireDemoSession(request, { mutation: true })
    const body = await objectBody(request)
    const linkedAccountId = stringField(body, "linkedAccountId")
    const account = await authorizedAccount(linkedAccountId, session, request.signal)
    const requestedModels = stringArrayField(body, "models")
    if (requestedModels?.length) {
      await Promise.all(requestedModels.map((model) =>
        requireProviderModel(account.provider, model, request.signal),
      ))
    }
    const runs = await openmerge().linkedAccounts.sync(
      linkedAccountId,
      requestedModels?.length ? requestedModels : undefined,
      { signal: request.signal },
    )
    return NextResponse.json({ runs, acceptedAt: Date.now() }, { status: 202 })
  } catch (error) {
    return failure(error)
  }
}
