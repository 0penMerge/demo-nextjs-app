import { NextResponse } from "next/server"
import { requireDemoSession } from "@/lib/demo-auth"
import { failure } from "@/lib/http"
import { openmerge, publicConfiguration, workspaceId } from "@/lib/openmerge"

export async function GET(request: Request) {
  try {
    const session = requireDemoSession(request)
    const configuration = publicConfiguration()
    if (!configuration.configured) {
      return NextResponse.json({ ...configuration, reachable: false, accountCount: 0, error: "Server credentials are not configured." }, { status: 503 })
    }
    const accounts = await openmerge().linkedAccounts.list(workspaceId(), { signal: request.signal })
    const accountCount = accounts.filter((account) =>
      account.wsid === workspaceId() && account.end_user_origin_id === session.endUserOriginId,
    ).length
    return NextResponse.json({ ...configuration, reachable: true, accountCount })
  } catch (error) {
    return failure(error)
  }
}
