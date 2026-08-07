"use client"

import { type FormEvent, type ReactNode, useEffect, useState } from "react"

type Session = {
  authenticated: true
  endUserOriginId: string
  expiresAt: number
}

async function sessionRequest(init?: RequestInit): Promise<Session> {
  const response = await fetch("/api/demo/session", { cache: "no-store", ...init })
  const body = await response.json().catch(() => ({})) as { error?: string } & Partial<Session>
  if (!response.ok) throw new Error(body.error || "Demo authentication failed.")
  return body as Session
}

export function DemoAccessGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [accessKey, setAccessKey] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    void sessionRequest()
      .then(setSession)
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!session) return
    const remaining = Math.max(0, Math.min(session.expiresAt - Date.now(), 2_147_483_647))
    const timer = window.setTimeout(() => setSession(undefined), remaining)
    return () => window.clearTimeout(timer)
  }, [session])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const next = await sessionRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessKey }),
      })
      setSession(next)
      setAccessKey("")
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Demo authentication failed.")
    } finally {
      setSubmitting(false)
    }
  }

  async function signOut() {
    await fetch("/api/demo/session", { method: "DELETE" }).catch(() => undefined)
    setSession(undefined)
  }

  if (loading) {
    return <main className="demo-access-shell"><p>Validating demo session...</p></main>
  }

  if (!session) {
    return (
      <main className="demo-access-shell">
        <form className="demo-access-card" onSubmit={signIn}>
          <span className="kicker">Protected acceptance environment</span>
          <h1>OpenMerge CRM starter</h1>
          <p>
            Enter the demo access key. OpenMerge workspace credentials never reach the browser,
            and this session is bound to one configured customer identity.
          </p>
          <label>
            <span>Demo access key</span>
            <input
              type="password"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              autoComplete="current-password"
              minLength={16}
              maxLength={512}
              required
              autoFocus
            />
          </label>
          {error && <p className="demo-access-error" role="alert">{error}</p>}
          <button className="button primary wide" disabled={submitting || accessKey.length < 16}>
            {submitting ? "Authenticating..." : "Enter demo"}
          </button>
        </form>
      </main>
    )
  }

  return (
    <>
      <button className="demo-sign-out" onClick={() => void signOut()} type="button">
        End demo session
      </button>
      {children}
    </>
  )
}
