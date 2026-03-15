export * from "./channel-plugin-common.js";
import type { OpenClawConfig } from "../config/config.js";
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
export declare function listIMessageAccountIds(cfg: OpenClawConfig): string[];
export declare function resolveDefaultIMessageAccountId(_cfg: OpenClawConfig): string;
export declare function resolveIMessageAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedIMessageAccount;
export declare function parseChatAllowTargetPrefixes(value: string): string[];
export declare function parseChatTargetPrefixesOrThrow(value: string): string[];
export declare function resolveServicePrefixedAllowTarget(value: string): string;
export declare function resolveServicePrefixedTarget(value: string): string;
export declare function resolveServicePrefixedChatTarget(value: string): ParsedChatTarget;
export declare function resolveServicePrefixedOrChatAllowTarget(value: string): string;
export declare function createAllowedChatSenderMatcher(params: ChatSenderAllowParams): (candidate: string) => boolean;
export { formatTrimmedAllowFromEntries, resolveIMessageConfigAllowFrom, resolveIMessageConfigDefaultTo, } from "./channel-config-helpers.js";
export { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget, } from "../channels/plugins/normalize/imessage.js";
export { resolveAllowlistProviderRuntimeGroupPolicy, resolveDefaultGroupPolicy, } from "../config/runtime-group-policy.js";
export { resolveIMessageGroupRequireMention, resolveIMessageGroupToolPolicy, } from "../channels/plugins/group-mentions.js";
export { imessageOnboardingAdapter } from "../channels/plugins/onboarding/imessage.js";
export { IMessageConfigSchema } from "../config/zod-schema.providers-core.js";
export { resolveChannelMediaMaxBytes } from "../channels/plugins/media-limits.js";
export { collectStatusIssuesFromLastError } from "./status-helpers.js";
