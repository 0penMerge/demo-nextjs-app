import { NextResponse } from "next/server"
import { failure, objectBody, stringField } from "@/lib/http"
import {
  applicationOrigin,
  embedUrl,
  openmerge,
  workspaceId,
} from "@/lib/openmerge"

export async function POST(request: Request) {
  try {
    const body = await objectBody(request)
    const linkedAccountId =
      typeof body.linkedAccountId === "string"
        ? body.linkedAccountId.trim()
        : ""

    const token = linkedAccountId
      ? await openmerge().linkTokens.reconnect(
          {
            workspaceId: workspaceId(),
            linkedAccountId,
            hostOrigin: applicationOrigin(),
          },
          { signal: request.signal },
        )
      : await openmerge().linkTokens.create(
          {
            workspaceId: workspaceId(),
            endUserOriginId: stringField(body, "endUserOriginId", {
              max: 200,
            }),
            allowedCategories: ["crm"],
            hostOrigin: applicationOrigin(),
          },
          { signal: request.signal },
        )

    return NextResponse.json(
      {
        token: token.token,
        expiresIn: token.expiresIn,
        hostedUrl: token.hostedUrl,
        embedUrl: embedUrl(),
      },
      { status: 201 },
    )
  } catch (error) {
    return failure(error)
  }
}