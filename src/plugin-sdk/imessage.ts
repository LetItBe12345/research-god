export * from "./channel-plugin-common.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeAccountId } from "../routing/session-key.js";

function resolveIMessageRoot(cfg: OpenClawConfig) {
  return cfg.channels?.imessage ?? {};
}

export type ResolvedIMessageAccount = {
  accountId: string;
  config: Record<string, unknown>;
};

export type ParsedChatTarget = {
  service?: string;
  target: string;
};

export type ChatSenderAllowParams = {
  allowTargets?: string[];
};

export function listIMessageAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = Object.keys(resolveIMessageRoot(cfg).accounts ?? {});
  return accounts.length > 0 ? accounts : ["default"];
}

export function resolveDefaultIMessageAccountId(_cfg: OpenClawConfig): string {
  return "default";
}

export function resolveIMessageAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedIMessageAccount {
  const normalized = normalizeAccountId(accountId);
  const root = resolveIMessageRoot(cfg);
  const config = (normalized ? root.accounts?.[normalized] : undefined) ?? root.accounts?.default ?? root;
  return { accountId: normalized || "default", config: config ?? {} };
}

export function parseChatAllowTargetPrefixes(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseChatTargetPrefixesOrThrow(value: string): string[] {
  const parsed = parseChatAllowTargetPrefixes(value);
  if (parsed.length === 0) {
    throw new Error("Expected at least one chat target prefix.");
  }
  return parsed;
}

export function resolveServicePrefixedAllowTarget(value: string): string {
  return value.trim();
}

export function resolveServicePrefixedTarget(value: string): string {
  return value.trim();
}

export function resolveServicePrefixedChatTarget(value: string): ParsedChatTarget {
  const trimmed = value.trim();
  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex === -1) {
    return { target: trimmed };
  }
  return {
    service: trimmed.slice(0, separatorIndex).trim() || undefined,
    target: trimmed.slice(separatorIndex + 1).trim(),
  };
}

export function resolveServicePrefixedOrChatAllowTarget(value: string): string {
  return resolveServicePrefixedAllowTarget(value);
}

export function createAllowedChatSenderMatcher(params: ChatSenderAllowParams) {
  const allowed = new Set((params.allowTargets ?? []).map((entry) => entry.trim()).filter(Boolean));
  return (candidate: string) => allowed.size === 0 || allowed.has(candidate.trim());
}

export {
  formatTrimmedAllowFromEntries,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./channel-config-helpers.js";
export {
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget,
} from "../channels/plugins/normalize/imessage.js";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
} from "../config/runtime-group-policy.js";
export {
  resolveIMessageGroupRequireMention,
  resolveIMessageGroupToolPolicy,
} from "../channels/plugins/group-mentions.js";
export { imessageOnboardingAdapter } from "../channels/plugins/onboarding/imessage.js";
export { IMessageConfigSchema } from "../config/zod-schema.providers-core.js";
export { resolveChannelMediaMaxBytes } from "../channels/plugins/media-limits.js";
export { collectStatusIssuesFromLastError } from "./status-helpers.js";
