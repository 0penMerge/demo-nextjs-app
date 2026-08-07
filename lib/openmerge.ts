import "server-only"

import { OpenMerge } from "@openmerge/core"

function required(name: "OPENMERGE_API_KEY" | "OPENMERGE_WORKSPACE_ID") {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

let client: OpenMerge | undefined

export function openmerge() {
  client ??= new OpenMerge({
    apiKey: required("OPENMERGE_API_KEY"),
    baseUrl: process.env.OPENMERGE_API_URL?.trim() || "http://localhost:8000",
    timeoutMs: 30_000,
  })
  return client
}

export function workspaceId() {
  return required("OPENMERGE_WORKSPACE_ID")
}

export function embedUrl() {
  return new URL(process.env.NEXT_PUBLIC_OPENMERGE_EMBED_URL?.trim() || "http://localhost:3001").origin
}

export function applicationOrigin() {
  return new URL(
    process.env.OPENMERGE_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "http://localhost:3000",
  ).origin
}

export function publicConfiguration() {
  return {
    configured: Boolean(process.env.OPENMERGE_API_KEY?.trim() && process.env.OPENMERGE_WORKSPACE_ID?.trim()),
    apiOrigin: new URL(process.env.OPENMERGE_API_URL?.trim() || "http://localhost:8000").origin,
    embedOrigin: embedUrl(),
  }
}
