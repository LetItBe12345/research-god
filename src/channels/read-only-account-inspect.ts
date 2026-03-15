import type { OpenClawConfig } from "../config/config.js";
import type { ChannelId } from "./plugins/types.js";

export type ReadOnlyInspectedAccount = {
  accountId?: string;
  enabled?: boolean;
  configured?: boolean;
  config?: Record<string, unknown>;
};

function inspectDisabledReadOnlyAccount(accountId?: string | null): ReadOnlyInspectedAccount {
  return {
    accountId: accountId?.trim() || undefined,
    enabled: false,
    configured: false,
    config: {},
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
    return inspectDisabledReadOnlyAccount(params.accountId);
  }
  return null;
}
