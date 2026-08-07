import { NextResponse } from "next/server"
import { authorizedAccount } from "@/lib/account-access"
import { requireProviderModel } from "@/lib/catalog"
import { requireDemoSession } from "@/lib/demo-auth"
import { failure } from "@/lib/http"
import { openmerge, workspaceId } from "@/lib/openmerge"

export async function GET(request: Request) {
  try {
    const session = requireDemoSession(request)
    const query = new URL(request.url).searchParams
    const linkedAccountId = query.get("linkedAccountId")?.trim()
    const model = query.get("model")?.trim() || "Contact"
    const cursor = query.get("cursor")?.trim() || undefined
    const rawPageSize = query.get("pageSize")
    const pageSize = rawPageSize ? Number(rawPageSize) : 25
    if (!linkedAccountId) throw new TypeError("linkedAccountId is required")
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new TypeError("pageSize must be an integer between 1 and 100")
    }

    const account = await authorizedAccount(linkedAccountId, session, request.signal)
    await requireProviderModel(account.provider, model, request.signal)
    return NextResponse.json(
      await openmerge().unifiedRecords.listPage(
        model,
        { workspaceId: workspaceId(), linkedAccountId, cursor, pageSize },
        { signal: request.signal },
      ),
    )
  } catch (error) {
    return failure(error)
  }
}
