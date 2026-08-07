import "server-only"

import { applicationOrigin } from "@/lib/openmerge"
import { constantTimeEqual, sealDemoSession, type DemoSession, unsealDemoSession } from "@/lib/demo-auth-core"

export const DEMO_SESSION_COOKIE = "openmerge_demo_session"
const DEFAULT_SESSION_SECONDS = 8 * 60 * 60

export class DemoAccessError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
    this.name = "DemoAccessError"
  }
}

function required(name: string, minimumLength = 1) {
  const value = process.env[name]?.trim()
  if (!value || value.length < minimumLength) {
    throw new DemoAccessError("The demo access boundary is not configured.", 503, "demo_access_not_configured")
  }
  return value
}

function sessionSecret() {
  return required("OPENMERGE_DEMO_SESSION_SECRET", 32)
}

export function configuredEndUserOriginId() {
  const value = required("OPENMERGE_DEMO_END_USER_ORIGIN_ID")
  if (value.length > 200) {
    throw new DemoAccessError("The demo access boundary is not configured.", 503, "demo_access_not_configured")
  }
  return value
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || ""
  for (const item of cookie.split(";")) {
    const separator = item.indexOf("=")
    if (separator < 0) continue
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim())
    }
  }
  return undefined
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin || origin !== applicationOrigin()) {
    throw new DemoAccessError("Cross-origin request rejected.", 403, "cross_origin_request")
  }
}

export function requireDemoSession(request: Request, options: { mutation?: boolean } = {}): DemoSession {
  if (options.mutation) assertSameOrigin(request)
  const token = cookieValue(request, DEMO_SESSION_COOKIE)
  const session = token ? unsealDemoSession(token, sessionSecret()) : undefined
  if (!session) {
    throw new DemoAccessError("Demo authentication is required.", 401, "demo_authentication_required")
  }
  if (session.endUserOriginId !== configuredEndUserOriginId()) {
    throw new DemoAccessError("Demo session is no longer authorized.", 401, "demo_session_revoked")
  }
  return session
}

export function authenticateDemo(accessKey: string): DemoSession {
  const expected = required("OPENMERGE_DEMO_ACCESS_KEY", 16)
  if (!constantTimeEqual(accessKey, expected)) {
    throw new DemoAccessError("Invalid demo access key.", 401, "invalid_demo_access_key")
  }
  const rawDuration = Number(process.env.OPENMERGE_DEMO_SESSION_SECONDS)
  const duration = Number.isInteger(rawDuration) && rawDuration >= 300 && rawDuration <= 86_400
    ? rawDuration
    : DEFAULT_SESSION_SECONDS
  return { version: 1, endUserOriginId: configuredEndUserOriginId(), expiresAt: Date.now() + duration * 1000 }
}

export function sessionCookie(session: DemoSession) {
  const secure = applicationOrigin().startsWith("https://")
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))
  return [
    `${DEMO_SESSION_COOKIE}=${encodeURIComponent(sealDemoSession(session, sessionSecret()))}`,
    "Path=/", "HttpOnly", "SameSite=Strict", secure ? "Secure" : "", `Max-Age=${maxAge}`,
  ].filter(Boolean).join("; ")
}

export function expiredSessionCookie() {
  const secure = applicationOrigin().startsWith("https://")
  return [
    `${DEMO_SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Strict", secure ? "Secure" : "", "Max-Age=0",
  ].filter(Boolean).join("; ")
}
