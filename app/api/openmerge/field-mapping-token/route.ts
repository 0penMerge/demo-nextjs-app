import { NextResponse } from "next/server"
import { authorizedAccount } from "@/lib/account-access"
import { requireDemoSession } from "@/lib/demo-auth"
import { failure, objectBody, stringField } from "@/lib/http"
import { applicationOrigin, embedUrl, openmerge } from "@/lib/openmerge"

export async function POST(request: Request) {
  try {
    const session = requireDemoSession(request, { mutation: true })
    const body = await objectBody(request)
    const linkedAccountId = stringField(body, "linkedAccountId")
    const account = await authorizedAccount(linkedAccountId, session, request.signal)
    const token = await openmerge().connectionMappings.createToken(account.id, {
      hostOrigin: applicationOrigin(),
      signal: request.signal,
    })

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
