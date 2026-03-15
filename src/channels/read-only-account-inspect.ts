import type { OpenClawConfig } from "../config/config.js";
import type { ChannelId } from "./plugins/types.js";

export type ReadOnlyInspectedAccount = {
  accountId?: string;
  enabled?: boolean;
  configured?: boolean;
  config?: Record<string, unknown>;
};

function inspectConfigBackedReadOnlyAccount(params: {
  channelId: ChannelId;
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ReadOnlyInspectedAccount {
  const channelSection = params.cfg.channels?.[params.channelId];
  const accountId = params.accountId?.trim();
  const channelRecord =
    channelSection && typeof channelSection === "object" && !Array.isArray(channelSection)
      ? (channelSection as Record<string, unknown>)
      : {};
  const accounts =
    channelRecord.accounts &&
    typeof channelRecord.accounts === "object" &&
    !Array.isArray(channelRecord.accounts)
      ? (channelRecord.accounts as Record<string, unknown>)
      : undefined;
  const accountRecord =
    accountId && accounts?.[accountId] && typeof accounts[accountId] === "object"
      ? (accounts[accountId] as Record<string, unknown>)
      : {};
  const enabled =
    typeof accountRecord.enabled === "boolean"
      ? accountRecord.enabled
      : typeof channelRecord.enabled === "boolean"
        ? channelRecord.enabled
        : Boolean(channelSection);
  return {
    accountId: accountId || undefined,
    enabled,
    configured: Boolean(channelSection),
    config: { ...channelRecord, ...accountRecord },
  };
}

export function inspectReadOnlyChannelAccount(params: {
  channelId: ChannelId;
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ReadOnlyInspectedAccount | null {
  if (
    params.channelId === "discord" ||
    params.channelId === "slack" ||
    params.channelId === "telegram"
  ) {
    return inspectConfigBackedReadOnlyAccount(params);
  }
  return null;
}
