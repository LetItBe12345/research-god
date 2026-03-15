export type { ChannelMessageActionAdapter } from "../channels/plugins/types.js";
export * from "./channel-plugin-common.js";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeAccountId } from "../routing/session-key.js";

function resolveSignalRoot(cfg: OpenClawConfig) {
  return cfg.channels?.signal ?? {};
}

export type ResolvedSignalAccount = {
  accountId: string;
  config: Record<string, unknown>;
};

export function listSignalAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = Object.keys(resolveSignalRoot(cfg).accounts ?? {});
  return accounts.length > 0 ? accounts : ["default"];
}

export function resolveDefaultSignalAccountId(_cfg: OpenClawConfig): string {
  return "default";
}

export function resolveSignalAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedSignalAccount {
  const normalized = normalizeAccountId(accountId);
  const root = resolveSignalRoot(cfg);
  const config = (normalized ? root.accounts?.[normalized] : undefined) ?? root.accounts?.default ?? root;
  return { accountId: normalized || "default", config: config ?? {} };
}

export {
  looksLikeSignalTargetId,
  normalizeSignalMessagingTarget,
} from "../channels/plugins/normalize/signal.js";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
} from "../config/runtime-group-policy.js";
export { signalOnboardingAdapter } from "../channels/plugins/onboarding/signal.js";
export { SignalConfigSchema } from "../config/zod-schema.providers-core.js";
export { normalizeE164 } from "../utils.js";
export { resolveChannelMediaMaxBytes } from "../channels/plugins/media-limits.js";
export {
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
} from "./status-helpers.js";
