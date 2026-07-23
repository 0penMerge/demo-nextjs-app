import { NextResponse } from "next/server"
import { failure } from "@/lib/http"
import { openmerge, publicConfiguration, workspaceId } from "@/lib/openmerge"

export async function GET(request: Request) {
  const configuration = publicConfiguration()
  if (!configuration.configured) {
    return NextResponse.json(
      {
        ...configuration,
        reachable: false,
        accountCount: 0,
        error: "Server credentials are not configured.",
      },
      { status: 503 },
    )
  }

  try {
    const accounts = await openmerge().linkedAccounts.list(workspaceId(), {
      signal: request.signal,
    })
    return NextResponse.json({
      ...configuration,
      reachable: true,
      accountCount: accounts.length,
    })
  } catch (error) {
    return failure(error)
  }
}