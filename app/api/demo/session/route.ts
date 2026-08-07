import { NextResponse } from "next/server"
import {
  assertSameOrigin,
  authenticateDemo,
  expiredSessionCookie,
  requireDemoSession,
  sessionCookie,
} from "@/lib/demo-auth"
import { failure, objectBody, stringField } from "@/lib/http"

export async function GET(request: Request) {
  try {
    const session = requireDemoSession(request)
    return NextResponse.json({ authenticated: true, endUserOriginId: session.endUserOriginId, expiresAt: session.expiresAt })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body = await objectBody(request)
    const session = authenticateDemo(stringField(body, "accessKey", { max: 512 }))
    return NextResponse.json(
      { authenticated: true, endUserOriginId: session.endUserOriginId, expiresAt: session.expiresAt },
      { headers: { "set-cookie": sessionCookie(session) } },
    )
  } catch (error) {
    return failure(error)
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request)
    return NextResponse.json({ authenticated: false }, { headers: { "set-cookie": expiredSessionCookie() } })
  } catch (error) {
    return failure(error)
  }
}
