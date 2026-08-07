import { createHmac, timingSafeEqual } from "node:crypto"

export type DemoSession = {
  version: 1
  endUserOriginId: string
  expiresAt: number
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function constantTimeEqual(left: string, right: string) {
  const leftDigest = createHmac("sha256", "openmerge-demo-compare").update(left).digest()
  const rightDigest = createHmac("sha256", "openmerge-demo-compare").update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

export function sealDemoSession(session: DemoSession, secret: string) {
  const payload = encode(JSON.stringify(session))
  return `${payload}.${signature(payload, secret)}`
}

export function unsealDemoSession(token: string, secret: string, now = Date.now()): DemoSession | undefined {
  const separator = token.lastIndexOf(".")
  if (separator <= 0) return undefined
  const payload = token.slice(0, separator)
  if (!constantTimeEqual(token.slice(separator + 1), signature(payload, secret))) return undefined
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<DemoSession>
    if (value.version !== 1 || typeof value.endUserOriginId !== "string" || !value.endUserOriginId || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt) || value.expiresAt <= now) return undefined
    return value as DemoSession
  } catch {
    return undefined
  }
}
