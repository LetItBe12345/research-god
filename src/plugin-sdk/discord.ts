export type { ChannelMessageActionAdapter } from "../channels/plugins/types.js";
export type { OpenClawConfig } from "../config/config.js";
export * from "./channel-plugin-common.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeAccountId } from "../routing/session-key.js";

function resolveDiscordRoot(cfg: OpenClawConfig) {
  return cfg.channels?.discord ?? {};
}

export type ResolvedDiscordAccount = {
  accountId: string;
  config: Record<string, unknown>;
  token?: string;
  configured: boolean;
};

export type InspectedDiscordAccount = ResolvedDiscordAccount;
export type ThreadBindingTargetKind = "channel" | "thread";
export type ThreadBindingRecord = {
  sessionKey?: string;
  channelId?: string;
  threadId?: string;
  targetKind?: ThreadBindingTargetKind;
};
export type ThreadBindingManager = {
  listBySessionKey?: (sessionKey: string) => ThreadBindingRecord[];
  unbindBySessionKey?: (sessionKey: string) => number;
};

export function listDiscordAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = Object.keys(resolveDiscordRoot(cfg).accounts ?? {});
  return accounts.length > 0 ? accounts : ["default"];
}

export function resolveDefaultDiscordAccountId(_cfg: OpenClawConfig): string {
  return "default";
}

export function resolveDiscordAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedDiscordAccount {
  const normalized = normalizeAccountId(accountId);
  const root = resolveDiscordRoot(cfg);
  const config = (normalized ? root.accounts?.[normalized] : undefined) ?? root.accounts?.default ?? root;
  const token = typeof config?.token === "string" ? config.token : undefined;
  return {
    accountId: normalized || "default",
    config: config ?? {},
    token,
    configured: Boolean(token),
  };
}

export function inspectDiscordAccount(cfg: OpenClawConfig, accountId?: string | null): InspectedDiscordAccount {
  return resolveDiscordAccount(cfg, accountId);
}

export function collectDiscordAuditChannelIds(): string[] {
  return [];
}

export {
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
} from "../channels/account-snapshot-fields.js";
export {
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
} from "../channels/plugins/directory-config.js";
export {
  looksLikeDiscordTargetId,
  normalizeDiscordMessagingTarget,
  normalizeDiscordOutboundTarget,
} from "../channels/plugins/normalize/discord.js";
export { collectDiscordStatusIssues } from "../channels/plugins/status-issues/discord.js";
export {
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
} from "../config/runtime-group-policy.js";
export {
  resolveDiscordGroupRequireMention,
  resolveDiscordGroupToolPolicy,
} from "../channels/plugins/group-mentions.js";
export { discordOnboardingAdapter } from "../channels/plugins/onboarding/discord.js";
export { DiscordConfigSchema } from "../config/zod-schema.providers-core.js";
export function autoBindSpawnedDiscordSubagent() {}
export function listThreadBindingsBySessionKey(): [] {
  return [];
}
export function unbindThreadBindingsBySessionKey() {}
export {
  buildComputedAccountStatusSnapshot,
  buildTokenChannelStatusSummary,
} from "./status-helpers.js";
