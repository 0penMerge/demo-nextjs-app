"use client"

import Image from "next/image"
import { useOpenMergeLink } from "@openmerge/react"
import type { LinkedAccount, SyncRun, UnifiedRecord, Writeback } from "@openmerge/core"
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Database,
  Link2,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Unplug,
  Zap,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DemoCatalog } from "@/lib/catalog-types"
import {
  pickWritableData,
  providerDefinition,
  supportedModels,
  writableFields,
} from "@/lib/catalog-types"

type LinkSession = {
  token: string
  embedUrl: string
  expiresIn: number
  hostedUrl: string
}
type RecordPage = {
  records: Array<UnifiedRecord<Record<string, unknown>>>
  nextCursor: string | null
}
type Health = {
  configured: boolean
  reachable: boolean
  accountCount: number
  apiOrigin: string
  embedOrigin: string
  error?: string
}
type EventKind = "success" | "info" | "error"
type ActivityEvent = {
  id: string
  kind: EventKind
  title: string
  detail: string
  at: number
}
type JsonError = {
  error?: string
  code?: string
  requestId?: string
  retryable?: boolean
}

async function jsonRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      accept: "application/json",
      ...init?.headers,
    },
  })
  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { error: text }
    }
  }
  if (!response.ok) {
    const errorBody = body as JsonError | null
    const message =
      errorBody?.error || `Request failed with status ${response.status}`
    const error = new Error(message)
    Object.assign(error, {
      code: errorBody?.code,
      requestId: errorBody?.requestId,
      retryable: errorBody?.retryable,
    })
    throw error
  }
  return body as T
}

function relativeTime(timestamp?: number | null) {
  if (!timestamp) return "Never"
  const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000
  const delta = Date.now() - milliseconds
  if (delta < 60_000) return "Just now"
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(milliseconds)
}

function recordLabel(record: UnifiedRecord<Record<string, unknown>>) {
  const data = record.data
  const name =
    data.name ||
    [data.first_name, data.last_name].filter(Boolean).join(" ") ||
    data.email ||
    record.unified_id
  return String(name)
}

function summaryFields(data: Record<string, unknown>) {
  const preferred = [
    "email",
    "phone",
    "name",
    "first_name",
    "last_name",
    "industry",
    "website",
  ]
  const entries = preferred
    .filter((key) => data[key] !== undefined && data[key] !== null)
    .map((key) => [key, data[key]] as const)
  return entries.slice(0, 3)
}

function statusTone(status: string) {
  if (status === "healthy") return "healthy"
  if (status === "needs_reauth") return "warning"
  if (status === "paused") return "neutral"
  return "danger"
}

function LinkLauncher({
  session,
  onSuccess,
  onClose,
  onError,
}: {
  session: LinkSession
  onSuccess(): void
  onClose(): void
  onError(message: string): void
}) {
  const settled = useRef(false)
  const { open } = useOpenMergeLink({
    token: session.token,
    embedUrl: session.embedUrl,
    onSuccess: () => {
      settled.current = true
      onSuccess()
    },
    onClose: () => {
      if (!settled.current) onClose()
    },
    onError: ({ message }) => {
      settled.current = true
      onError(message)
    },
  })

  useEffect(() => {
    open()
  }, [open])

  return null
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode
  title: string
  detail: string
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

export function OpenMergeConsole() {
  const [session, setSession] = useState<LinkSession>()
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [model, setModel] = useState("Contact")
  const [catalog, setCatalog] = useState<DemoCatalog>({ providers: [], models: [] })
  const [records, setRecords] = useState<RecordPage>({
    records: [],
    nextCursor: null,
  })
  const [selectedRecordId, setSelectedRecordId] = useState("")
  const [changes, setChanges] = useState("{}")
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  )
  const [health, setHealth] = useState<Health>()
  const [busy, setBusy] = useState("")
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [error, setError] = useState("")
  const [rawResult, setRawResult] = useState<unknown>()
  const [intentProvider, setIntentProvider] = useState("")

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId],
  )
  const selectedRecord = useMemo(
    () => records.records.find((record) => record.unified_id === selectedRecordId),
    [records.records, selectedRecordId],
  )
  const availableModels = useMemo(
    () => supportedModels(catalog, selectedAccount?.provider || ""),
    [catalog, selectedAccount?.provider],
  )

  const pushEvent = useCallback(
    (kind: EventKind, title: string, detail: string) => {
      setEvents((current) =>
        [
          {
            id: crypto.randomUUID(),
            kind,
            title,
            detail,
            at: Date.now(),
          },
          ...current,
        ].slice(0, 8),
      )
    },
    [],
  )

  const refreshCatalog = useCallback(async () => {
    const next = await jsonRequest<DemoCatalog>("/api/openmerge/catalog")
    setCatalog(next)
    return next
  }, [])
  const refreshAccounts = useCallback(async () => {
    const next = await jsonRequest<LinkedAccount[]>("/api/openmerge/accounts")
    setAccounts(next)
    setSelectedAccountId((current) =>
      next.some((account) => account.id === current)
        ? current
        : next[0]?.id || "",
    )
    return next
  }, [])

  const refreshHealth = useCallback(async () => {
    try {
      const next = await jsonRequest<Health>("/api/openmerge/health")
      setHealth(next)
      return next
    } catch (nextError) {
      setHealth({
        configured: false,
        reachable: false,
        accountCount: 0,
        apiOrigin: "OpenMerge API",
        embedOrigin: "OpenMerge Embed",
        error: nextError instanceof Error ? nextError.message : String(nextError),
      })
      throw nextError
    }
  }, [])

  const loadRecords = useCallback(
    async (accountId = selectedAccountId, nextModel = model) => {
      if (!accountId) return { records: [], nextCursor: null } as RecordPage
      const page = await jsonRequest<RecordPage>(
        `/api/openmerge/records?linkedAccountId=${encodeURIComponent(accountId)}&model=${encodeURIComponent(nextModel)}&pageSize=50`,
      )
      setRecords(page)
      setSelectedRecordId((current) =>
        page.records.some((record) => record.unified_id === current)
          ? current
          : page.records[0]?.unified_id || "",
      )
      return page
    },
    [model, selectedAccountId],
  )

  useEffect(() => {
    void Promise.all([refreshHealth(), refreshAccounts(), refreshCatalog()]).catch(() => undefined)
  }, [refreshAccounts, refreshCatalog, refreshHealth])

  useEffect(() => {
    if (!selectedAccount) return
    if (!availableModels.includes(model)) setModel(availableModels[0] || "Contact")
    setRecords({ records: [], nextCursor: null })
    setSelectedRecordId("")
  }, [availableModels, model, selectedAccount])

  useEffect(() => {
    if (!selectedRecord || !selectedAccount) return
    setChanges(
      JSON.stringify(
        pickWritableData(catalog, selectedAccount.provider, model, selectedRecord.data),
        null,
        2,
      ),
    )
    setIdempotencyKey(crypto.randomUUID())
  }, [catalog, model, selectedAccount, selectedRecord])

  async function run<T>(
    key: string,
    work: () => Promise<T>,
    success?: (result: T) => { title: string; detail: string },
  ) {
    setBusy(key)
    setError("")
    try {
      const result = await work()
      setRawResult(result)
      if (success) {
        const event = success(result)
        pushEvent("success", event.title, event.detail)
      }
      return result
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : String(nextError)
      setError(message)
      pushEvent("error", "Request failed", message)
      return undefined
    } finally {
      setBusy("")
    }
  }

  async function launchConnect(provider = "") {
    setIntentProvider(provider)
    await run(
      "connect",
      async () => {
        const next = await jsonRequest<LinkSession>(
          "/api/openmerge/link-token",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}),
          },
        )
        setSession(next)
        return next
      },
      () => ({
        title: "Secure link session created",
        detail: "The CRM-only widget is ready. The workspace key stayed server-side.",
      }),
    )
  }

  async function launchReconnect(account: LinkedAccount) {
    setIntentProvider(account.provider)
    await run(
      `reconnect-${account.id}`,
      async () => {
        const next = await jsonRequest<LinkSession>(
          "/api/openmerge/link-token",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ linkedAccountId: account.id }),
          },
        )
        setSession(next)
        return next
      },
      () => ({
        title: "Reconnect session created",
        detail: `${account.provider_display_name || account.provider} is provider-locked.`,
      }),
    )
  }

  async function pullNow() {
    if (!selectedAccount) return
    const result = await run(
      "sync",
      () =>
        jsonRequest<{ runs: SyncRun[]; acceptedAt: number }>(
          "/api/openmerge/accounts",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              linkedAccountId: selectedAccount.id,
              models: [model],
            }),
          },
        ),
      (next) => ({
        title: "Incremental sync queued",
        detail: `${next.runs.length} Temporal run${next.runs.length === 1 ? "" : "s"} accepted for ${model}.`,
      }),
    )
    if (!result) return

    window.setTimeout(() => {
      void Promise.all([refreshAccounts(), loadRecords()]).catch(() => undefined)
    }, 3500)
  }

  async function readRecords() {
    if (!selectedAccount) return
    await run(
      "records",
      () => loadRecords(),
      (page) => ({
        title: `${model} materialization loaded`,
        detail: `${page.records.length} unified record${page.records.length === 1 ? "" : "s"} returned.`,
      }),
    )
  }

  async function pushAndReconcile() {
    if (!selectedAccount || !selectedRecord) return
    let parsed: unknown
    try {
      parsed = JSON.parse(changes)
    } catch {
      setError("Changes must be valid JSON.")
      return
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setError("Changes must be a JSON object.")
      return
    }

    const result = await run(
      "writeback",
      () =>
        jsonRequest<{
          writeback: Writeback
          syncRuns: SyncRun[]
        }>("/api/openmerge/writebacks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            linkedAccountId: selectedAccount.id,
            model,
            unifiedId: selectedRecord.unified_id,
            changes: parsed,
            idempotencyKey,
            reconcile: true,
          }),
        }),
      (next) => ({
        title: "Writeback completed",
        detail: `Provider update ${next.writeback.id} completed; reconciliation was queued.`,
      }),
    )
    if (!result) return
    setIdempotencyKey(crypto.randomUUID())
    window.setTimeout(() => {
      void Promise.all([refreshAccounts(), loadRecords()]).catch(() => undefined)
    }, 3500)
  }

  function chooseRecord(record: UnifiedRecord<Record<string, unknown>>) {
    setSelectedRecordId(record.unified_id)
  }

  const providerAccounts = (provider: string) =>
    accounts.filter((account) => account.provider === provider)

  return (
    <section className="workspace" aria-label="OpenMerge CRM demo">
      {session && (
        <LinkLauncher
          session={session}
          onSuccess={() => {
            const provider = providerDefinition(catalog, intentProvider)?.name || "CRM"
            setSession(undefined)
            pushEvent("success", "Account connected", `${provider} OAuth completed.`)
            void Promise.all([refreshAccounts(), refreshHealth()])
          }}
          onClose={() => {
            setSession(undefined)
            pushEvent("info", "Connect flow closed", "No account changes were made.")
          }}
          onError={(message) => {
            setSession(undefined)
            setError(message)
            pushEvent("error", "Connect flow failed", message)
          }}
        />
      )}

      <div className="topbar">
        <div className="brand">
          <span className="brand-mark"><Image src="/openmerge-mark.svg" alt="" width={28} height={28} aria-hidden="true" /></span>
          <span>OpenMerge</span>
          <span className="brand-slash">/</span>
          <span className="brand-muted">CRM starter</span>
        </div>
        <div className="environment">
          <span className={`health-dot ${health?.reachable ? "online" : ""}`} />
          <span>{health?.reachable ? "Control plane online" : "Control plane unavailable"}</span>
          <span className="environment-count">{accounts.length} linked</span>
        </div>
      </div>

      <div className="hero-panel">
        <div>
          <span className="kicker"><Zap size={13} /> Production acceptance surface</span>
          <h1>One CRM contract.<br />Four providers.</h1>
          <p>
            Connect a customer account, materialize unified records, and prove
            an idempotent provider writeback without exposing your OpenMerge key.
          </p>
          <div className="hero-actions">
            <span className="customer-input">
              <span>Customer identity</span>
              <strong>Bound to signed demo session</strong>
            </span>
            <button
              className="button primary"
              disabled={Boolean(busy)}
              onClick={() => void launchConnect()}
            >
              {busy === "connect" ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />}
              Connect CRM
            </button>
          </div>
          <div className="security-line">
            <ShieldCheck size={14} />
            Short-lived link tokens in the browser. Workspace API key on the server only.
          </div>
        </div>
        <div className="flow-card" aria-label="Data flow">
          <div className="flow-step active">
            <span><Link2 size={16} /></span>
            <div><strong>Connect</strong><small>OAuth in OpenMerge Link</small></div>
            <Check size={14} />
          </div>
          <div className="flow-rail" />
          <div className="flow-step">
            <span><ArrowDownToLine size={16} /></span>
            <div><strong>Pull</strong><small>Incremental sync via Temporal</small></div>
            <ChevronRight size={14} />
          </div>
          <div className="flow-rail" />
          <div className="flow-step">
            <span><Database size={16} /></span>
            <div><strong>Unify</strong><small>Canonical CRM records</small></div>
            <ChevronRight size={14} />
          </div>
          <div className="flow-rail" />
          <div className="flow-step">
            <span><ArrowUpFromLine size={16} /></span>
            <div><strong>Write back</strong><small>Idempotent, governed update</small></div>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>

      {error && (
        <div className="alert" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>Ã—</button>
        </div>
      )}

      <div className="section-heading">
        <div>
          <span className="section-label">Connectors</span>
          <h2>CRM coverage</h2>
        </div>
        <span className="section-note">
          Provider choice is confirmed inside the CRM-scoped widget.
        </span>
      </div>

      <div className="provider-grid">
        {catalog.providers.map((provider) => {
          const linked = providerAccounts(provider.id)
          const healthy = linked.filter((account) => account.status === "healthy").length
          return (
            <article className="provider-card" key={provider.id}>
              <div className="provider-card-top">
                <span className={`provider-mark ${provider.id}`}>{provider.mark}</span>
                {linked.length ? (
                  <span className="linked-badge">
                    <span className={`health-dot ${healthy ? "online" : ""}`} />
                    {linked.length} linked
                  </span>
                ) : (
                  <span className="linked-badge muted">Not connected</span>
                )}
              </div>
              <h3>{provider.name}</h3>
              <p>{provider.description}</p>
              <div className="model-chips">
                {provider.models.map((item) => <span key={item}>{item}</span>)}
              </div>
              <button
                className="card-action"
                disabled={Boolean(busy)}
                onClick={() => void launchConnect(provider.id)}
              >
                {linked.length ? "Add another account" : "Connect account"}
                <ArrowRight size={15} />
              </button>
            </article>
          )
        })}
      </div>

      <div className="section-heading account-heading">
        <div>
          <span className="section-label">Runtime</span>
          <h2>Linked accounts</h2>
        </div>
        <button
          className="button ghost"
          disabled={Boolean(busy)}
          onClick={() =>
            void run("refresh", refreshAccounts, (next) => ({
              title: "Accounts refreshed",
              detail: `${next.length} account${next.length === 1 ? "" : "s"} loaded.`,
            }))
          }
        >
          <RefreshCw className={busy === "refresh" ? "spin" : ""} size={15} />
          Refresh
        </button>
      </div>

      <div className="account-list">
        {accounts.length === 0 ? (
          <EmptyState
            icon={<Unplug size={19} />}
            title="No linked CRM accounts"
            detail="Connect a sandbox or developer CRM above to begin the acceptance flow."
          />
        ) : (
          accounts.map((account) => {
            const provider = providerDefinition(catalog, account.provider)
            const selected = account.id === selectedAccountId
            return (
              <button
                className={`account-row ${selected ? "selected" : ""}`}
                key={account.id}
                onClick={() => setSelectedAccountId(account.id)}
              >
                <span className={`provider-mark small ${account.provider}`}>
                  {provider?.mark || account.provider.slice(0, 2).toUpperCase()}
                </span>
                <span className="account-identity">
                  <strong>{account.provider_display_name || provider?.name || account.provider}</strong>
                  <small>{account.end_user_label || account.end_user_origin_id}</small>
                </span>
                <span className={`status-pill ${statusTone(account.status)}`}>
                  <span />{account.status.replace("_", " ")}
                </span>
                <span className="account-stat">
                  <small>Last sync</small>
                  <strong>{relativeTime(account.last_sync_at)}</strong>
                </span>
                <span className="account-stat desktop-only">
                  <small>Sync count</small>
                  <strong>{account.sync_count || 0}</strong>
                </span>
                <ChevronRight className="row-chevron" size={17} />
              </button>
            )
          })
        )}
      </div>

      <div className="workbench">
        <div className="workbench-header">
          <div>
            <span className="section-label">Two-way workbench</span>
            <h2>{selectedAccount ? providerDefinition(catalog, selectedAccount.provider)?.name || selectedAccount.provider : "Select an account"}</h2>
          </div>
          {selectedAccount && (
            <div className="workbench-actions">
              {selectedAccount.status === "needs_reauth" ? (
                <button
                  className="button secondary"
                  disabled={Boolean(busy)}
                  onClick={() => void launchReconnect(selectedAccount)}
                >
                  <RotateCcw size={15} />
                  Reconnect account
                </button>
              ) : (
                <>
                  <button
                    className="button ghost"
                    disabled={Boolean(busy) || selectedAccount.status !== "healthy"}
                    onClick={() => void pullNow()}
                  >
                    {busy === "sync" ? <LoaderCircle className="spin" size={15} /> : <ArrowDownToLine size={15} />}
                    Pull now
                  </button>
                  <button
                    className="button secondary"
                    disabled={Boolean(busy) || selectedAccount.status !== "healthy"}
                    onClick={() => void readRecords()}
                  >
                    {busy === "records" ? <LoaderCircle className="spin" size={15} /> : <Database size={15} />}
                    Read materialization
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {!selectedAccount ? (
          <EmptyState
            icon={<Database size={19} />}
            title="Choose a linked account"
            detail="The workbench is account-scoped to preserve tenant and provider boundaries."
          />
        ) : (
          <>
            <div className="model-tabs" role="tablist" aria-label="Unified model">
              {availableModels.map((item) => (
                <button
                  role="tab"
                  aria-selected={model === item}
                  className={model === item ? "active" : ""}
                  key={item}
                  onClick={() => setModel(item)}
                >
                  {item}
                </button>
              ))}
              <span className="model-hint">
                Writable: {writableFields(catalog, selectedAccount.provider, model).join(", ") || "none"}
              </span>
            </div>
            <div className="workbench-grid">
              <div className="records-pane">
                <div className="pane-title">
                  <div>
                    <strong>Unified {model}s</strong>
                    <small>{records.records.length} loaded</small>
                  </div>
                  <button
                    aria-label="Refresh records"
                    className="icon-button"
                    disabled={Boolean(busy)}
                    onClick={() => void readRecords()}
                  >
                    <RefreshCw className={busy === "records" ? "spin" : ""} size={15} />
                  </button>
                </div>
                <div className="record-list">
                  {records.records.length === 0 ? (
                    <EmptyState
                      icon={<Database size={18} />}
                      title={`No ${model.toLowerCase()} records loaded`}
                      detail="Pull from the provider, then read the materialized unified view."
                    />
                  ) : (
                    records.records.map((record) => (
                      <button
                        className={`record-row ${record.unified_id === selectedRecordId ? "selected" : ""}`}
                        key={record.unified_id}
                        onClick={() => chooseRecord(record)}
                      >
                        <span className="record-avatar">
                          {recordLabel(record).slice(0, 2).toUpperCase()}
                        </span>
                        <span className="record-copy">
                          <strong>{recordLabel(record)}</strong>
                          <small>
                            {summaryFields(record.data)
                              .map(([key, value]) => `${key}: ${String(value)}`)
                              .join(" Â· ") || record.unified_id}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="editor-pane">
                <div className="pane-title">
                  <div>
                    <strong>Provider writeback</strong>
                    <small>Update existing materialized records only</small>
                  </div>
                  <span className="server-badge"><ShieldCheck size={13} /> Server action</span>
                </div>
                {!selectedRecord ? (
                  <EmptyState
                    icon={<Code2 size={18} />}
                    title="Select a unified record"
                    detail="The editor will include only fields supported by this provider mapping."
                  />
                ) : (
                  <div className="editor-form">
                    <div className="record-meta">
                      <span>Unified ID</span>
                      <code>{selectedRecord.unified_id}</code>
                    </div>
                    <label className="json-editor">
                      <span>Writable changes (JSON)</span>
                      <textarea
                        value={changes}
                        onChange={(event) => setChanges(event.target.value)}
                        spellCheck={false}
                        rows={10}
                      />
                    </label>
                    <div className="idempotency">
                      <span>Idempotency key</span>
                      <code title={idempotencyKey}>{idempotencyKey}</code>
                    </div>
                    <button
                      className="button primary wide"
                      disabled={Boolean(busy) || selectedAccount.status !== "healthy"}
                      onClick={() => void pushAndReconcile()}
                    >
                      {busy === "writeback" ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <ArrowUpFromLine size={16} />
                      )}
                      Push & reconcile
                    </button>
                    <p className="editor-note">
                      Retries reuse the same key. A new key is issued only after a terminal success.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bottom-grid">
        <div className="activity-panel">
          <div className="pane-title">
            <div><strong>Activity</strong><small>Current browser session</small></div>
            <Activity size={16} />
          </div>
          {events.length === 0 ? (
            <EmptyState
              icon={<Clock3 size={18} />}
              title="No activity yet"
              detail="Connect, pull, read, or write to populate this timeline."
            />
          ) : (
            <div className="event-list">
              {events.map((event) => (
                <div className="event-row" key={event.id}>
                  <span className={`event-dot ${event.kind}`} />
                  <div>
                    <strong>{event.title}</strong>
                    <small>{event.detail}</small>
                  </div>
                  <time>{relativeTime(event.at)}</time>
                </div>
              ))}
            </div>
          )}
        </div>
        <details className="raw-panel">
          <summary>
            <span><Code2 size={15} /> Last API result</span>
            <ChevronRight size={15} />
          </summary>
          <pre>{rawResult ? JSON.stringify(rawResult, null, 2) : "No request result yet."}</pre>
        </details>
      </div>

      <footer>
        <span><ShieldCheck size={14} /> Tenant-scoped server routes</span>
        <span>â€¢</span>
        <span>Idempotent writes</span>
        <span>â€¢</span>
        <span>CRM-only link tokens</span>
      </footer>
    </section>
  )
}