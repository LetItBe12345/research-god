export type { ChannelMessageActionAdapter } from "../channels/plugins/types.js";
export * from "./channel-plugin-common.js";
import type { OpenClawConfig } from "../config/config.js";
export type ResolvedSignalAccount = {
    accountId: string;
    config: Record<string, unknown>;
};
export declare function listSignalAccountIds(cfg: OpenClawConfig): string[];
export declare function resolveDefaultSignalAccountId(_cfg: OpenClawConfig): string;
export declare function resolveSignalAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedSignalAccount;
export { looksLikeSignalTargetId, normalizeSignalMessagingTarget, } from "../channels/plugins/normalize/signal.js";
export { resolveAllowlistProviderRuntimeGroupPolicy, resolveDefaultGroupPolicy, } from "../config/runtime-group-policy.js";
export { signalOnboardingAdapter } from "../channels/plugins/onboarding/signal.js";
export { SignalConfigSchema } from "../config/zod-schema.providers-core.js";
export { normalizeE164 } from "../utils.js";
export { resolveChannelMediaMaxBytes } from "../channels/plugins/media-limits.js";
export { buildBaseAccountStatusSnapshot, buildBaseChannelStatusSummary, collectStatusIssuesFromLastError, createDefaultChannelRuntimeState, } from "./status-helpers.js";
