export type { OpenClawConfig } from "../config/config.js";
export * from "./channel-plugin-common.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeAccountId } from "../routing/session-key.js";

function resolveSlackRoot(cfg: OpenClawConfig) {
  return cfg.channels?.slack ?? {};
}

export type ResolvedSlackAccount = {
  accountId: string;
  config: Record<string, unknown>;
  botToken?: string;
  userToken?: string;
  actions?: Record<string, unknown>;
};

export type InspectedSlackAccount = ResolvedSlackAccount & { configured: boolean };

export function listSlackAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = Object.keys(resolveSlackRoot(cfg).accounts ?? {});
  return accounts.length > 0 ? accounts : ["default"];
}

export function listEnabledSlackAccounts(cfg: OpenClawConfig): ResolvedSlackAccount[] {
  return listSlackAccountIds(cfg).map((id) => resolveSlackAccount(cfg, id));
}

export function resolveDefaultSlackAccountId(_cfg: OpenClawConfig): string {
  return "default";
}

export function resolveSlackAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedSlackAccount {
  const normalized = normalizeAccountId(accountId);
  const root = resolveSlackRoot(cfg);
  const config = (normalized ? root.accounts?.[normalized] : undefined) ?? root.accounts?.default ?? root;
  return {
    accountId: normalized || "default",
    config: config ?? {},
    botToken: typeof config?.botToken === "string" ? config.botToken : undefined,
    userToken: typeof config?.userToken === "string" ? config.userToken : undefined,
    actions: (config?.actions as Record<string, unknown> | undefined) ?? (root.actions as Record<string, unknown> | undefined),
  };
}

export function resolveSlackReplyToMode(): "off" | "first" | "all" {
  return "all";
}

export function isSlackInteractiveRepliesEnabled(): boolean {
  return false;
}

export function inspectSlackAccount(cfg: OpenClawConfig, accountId?: string | null): InspectedSlackAccount {
  const account = resolveSlackAccount(cfg, accountId);
  return { ...account, configured: Boolean(account.botToken || account.userToken) };
}

export {
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
  resolveConfiguredFromRequiredCredentialStatuses,
} from "../channels/account-snapshot-fields.js";
export {
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
} from "../channels/plugins/directory-config.js";
export {
  looksLikeSlackTargetId,
  normalizeSlackMessagingTarget,
} from "../channels/plugins/normalize/slack.js";
export function extractSlackToolSend(_args: Record<string, unknown>): undefined {
  return undefined;
}
export function listSlackMessageActions(): string[] {
  return [];
}
export function buildSlackThreadingToolContext(): undefined {
  return undefined;
}
export { buildComputedAccountStatusSnapshot } from "./status-helpers.js";
export {
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
} from "../config/runtime-group-policy.js";
export {
  resolveSlackGroupRequireMention,
  resolveSlackGroupToolPolicy,
} from "../channels/plugins/group-mentions.js";
export { slackOnboardingAdapter } from "../channels/plugins/onboarding/slack.js";
export { SlackConfigSchema } from "../config/zod-schema.providers-core.js";
export { handleSlackMessageAction } from "./slack-message-actions.js";
