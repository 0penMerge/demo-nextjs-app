import { describe, expect, it } from "vitest"
import { constantTimeEqual, sealDemoSession, unsealDemoSession } from "@/lib/demo-auth-core"
import { accountMatchesTenant } from "@/lib/tenant-access-core"
import type { LinkedAccount } from "@openmerge/core"

const secret = "a-production-length-session-secret-for-tests"
const session = { version: 1 as const, endUserOriginId: "customer-001", expiresAt: 2_000 }

describe("demo session sealing", () => {
  it("round trips an authentic unexpired session", () => {
    expect(unsealDemoSession(sealDemoSession(session, secret), secret, 1_000)).toEqual(session)
  })

  it("rejects tampering, the wrong secret, and expired sessions", () => {
    const token = sealDemoSession(session, secret)
    expect(unsealDemoSession(`${token}x`, secret, 1_000)).toBeUndefined()
    expect(unsealDemoSession(token, `${secret}-wrong`, 1_000)).toBeUndefined()
    expect(unsealDemoSession(token, secret, 2_000)).toBeUndefined()
  })

  it("compares access keys without direct string equality", () => {
    expect(constantTimeEqual("approved-access-key", "approved-access-key")).toBe(true)
    expect(constantTimeEqual("approved-access-key", "wrong-access-key")).toBe(false)
  })
})

describe("tenant account boundary", () => {
  const account = {
    id: "la_1",
    wsid: "ws_1",
    provider: "pipedrive",
    end_user_origin_id: "customer-001",
    status: "healthy",
    created_at: 1,
  } satisfies LinkedAccount

  it("requires both workspace and authenticated customer identity", () => {
    expect(accountMatchesTenant(account, session, "ws_1")).toBe(true)
    expect(accountMatchesTenant({ ...account, wsid: "ws_other" }, session, "ws_1")).toBe(false)
    expect(accountMatchesTenant({ ...account, end_user_origin_id: "customer-other" }, session, "ws_1")).toBe(false)
  })
})
