import type { LinkedAccount } from "@openmerge/core"
import type { DemoSession } from "@/lib/demo-auth-core"

export function accountMatchesTenant(
  account: LinkedAccount,
  session: DemoSession,
  expectedWorkspaceId: string,
) {
  return account.wsid === expectedWorkspaceId &&
    account.end_user_origin_id === session.endUserOriginId
}
