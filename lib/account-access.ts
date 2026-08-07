import "server-only"

import type { LinkedAccount } from "@openmerge/core"
import { DemoAccessError } from "@/lib/demo-auth"
import type { DemoSession } from "@/lib/demo-auth-core"
import { openmerge, workspaceId } from "@/lib/openmerge"

export function accountBelongsToSession(account: LinkedAccount, session: DemoSession) {
  return account.wsid === workspaceId() && account.end_user_origin_id === session.endUserOriginId
}

export function assertAccountBelongsToSession(account: LinkedAccount, session: DemoSession) {
  if (!accountBelongsToSession(account, session)) {
    // Hide account existence across customer boundaries.
    throw new DemoAccessError("Linked account not found.", 404, "account_not_found")
  }
  return account
}

export async function authorizedAccount(linkedAccountId: string, session: DemoSession, signal?: AbortSignal) {
  const account = await openmerge().linkedAccounts.get(linkedAccountId, { signal })
  return assertAccountBelongsToSession(account, session)
}
