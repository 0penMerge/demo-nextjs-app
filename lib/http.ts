import {
  ApiError,
  OpenMergeError,
  RequestTimeoutError,
} from "@openmerge/core"
import { NextResponse } from "next/server"

export function failure(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        requestId: error.requestId,
        retryable: error.retryable,
      },
      { status: error.status },
    )
  }

  if (error instanceof RequestTimeoutError) {
    return NextResponse.json(
      { error: error.message, code: error.code, retryable: true },
      { status: 504 },
    )
  }

  if (error instanceof OpenMergeError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        requestId: error.requestId,
        retryable: error.retryable,
      },
      { status: 502 },
    )
  }

  const message =
    error instanceof Error ? error.message : "Unexpected OpenMerge error"
  return NextResponse.json(
    { error: message },
    { status: error instanceof TypeError ? 400 : 500 },
  )
}

export async function objectBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let value: unknown
  try {
    value = await request.json()
  } catch {
    throw new TypeError("Request body must be valid JSON")
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected a JSON object")
  }
  return value as Record<string, unknown>
}

export function stringField(
  body: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number } = {},
) {
  const value = body[key]
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${key} is required`)
  }
  const normalized = value.trim()
  if (options.min && normalized.length < options.min) {
    throw new TypeError(`${key} must contain at least ${options.min} characters`)
  }
  if (options.max && normalized.length > options.max) {
    throw new TypeError(`${key} must contain at most ${options.max} characters`)
  }
  return normalized
}

export function stringArrayField(
  body: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = body[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${key} must be an array of strings`)
  }
  return value.map((item) => item.trim()).filter(Boolean)
}