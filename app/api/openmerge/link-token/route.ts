import { NextResponse } from "next/server"
import { authorizedAccount } from "@/lib/account-access"
import { requireDemoSession } from "@/lib/demo-auth"
import { failure, objectBody } from "@/lib/http"
import { applicationOrigin, embedUrl, openmerge, workspaceId } from "@/lib/openmerge"

export async function POST(request: Request) {
  try {
    const session = requireDemoSession(request, { mutation: true })
    const body = await objectBody(request)
    const linkedAccountId = typeof body.linkedAccountId === "string" ? body.linkedAccountId.trim() : ""
    if (linkedAccountId) await authorizedAccount(linkedAccountId, session, request.signal)

    const token = linkedAccountId
      ? await openmerge().linkTokens.reconnect(
          { workspaceId: workspaceId(), linkedAccountId, endUserOriginId: session.endUserOriginId, hostOrigin: applicationOrigin() },
          { signal: request.signal },
        )
      : await openmerge().linkTokens.create(
          { workspaceId: workspaceId(), endUserOriginId: session.endUserOriginId, allowedCategories: ["crm"], hostOrigin: applicationOrigin() },
          { signal: request.signal },
        )

    return NextResponse.json(
      { token: token.token, expiresIn: token.expiresIn, hostedUrl: token.hostedUrl, embedUrl: embedUrl() },
      { status: 201 },
    )
  } catch (error) {
    return failure(error)
  }
}
