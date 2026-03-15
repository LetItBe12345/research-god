export type { ChannelMessageActionAdapter } from "../channels/plugins/types.js";
export type { OpenClawConfig } from "../config/config.js";
export * from "./channel-plugin-common.js";
import type { OpenClawConfig } from "../config/config.js";
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
export declare function listDiscordAccountIds(cfg: OpenClawConfig): string[];
export declare function resolveDefaultDiscordAccountId(_cfg: OpenClawConfig): string;
export declare function resolveDiscordAccount(cfg: OpenClawConfig, accountId?: string | null): ResolvedDiscordAccount;
export declare function inspectDiscordAccount(cfg: OpenClawConfig, accountId?: string | null): InspectedDiscordAccount;
export declare function collectDiscordAuditChannelIds(): string[];
export { projectCredentialSnapshotFields, resolveConfiguredFromCredentialStatuses, } from "../channels/account-snapshot-fields.js";
export { listDiscordDirectoryGroupsFromConfig, listDiscordDirectoryPeersFromConfig, } from "../channels/plugins/directory-config.js";
export { looksLikeDiscordTargetId, normalizeDiscordMessagingTarget, normalizeDiscordOutboundTarget, } from "../channels/plugins/normalize/discord.js";
export { collectDiscordStatusIssues } from "../channels/plugins/status-issues/discord.js";
export { resolveDefaultGroupPolicy, resolveOpenProviderRuntimeGroupPolicy, } from "../config/runtime-group-policy.js";
export { resolveDiscordGroupRequireMention, resolveDiscordGroupToolPolicy, } from "../channels/plugins/group-mentions.js";
export { discordOnboardingAdapter } from "../channels/plugins/onboarding/discord.js";
export { DiscordConfigSchema } from "../config/zod-schema.providers-core.js";
export declare function autoBindSpawnedDiscordSubagent(): void;
export declare function listThreadBindingsBySessionKey(): [];
export declare function unbindThreadBindingsBySessionKey(): void;
export { buildComputedAccountStatusSnapshot, buildTokenChannelStatusSummary, } from "./status-helpers.js";
