import type { OpenClawConfig } from "../config/config.js";
import type { ChannelId } from "./plugins/types.js";
export type ReadOnlyInspectedAccount = {
    accountId?: string;
    enabled?: boolean;
    configured?: boolean;
    config?: Record<string, unknown>;
};
export declare function inspectReadOnlyChannelAccount(params: {
    channelId: ChannelId;
    cfg: OpenClawConfig;
    accountId?: string | null;
}): ReadOnlyInspectedAccount | null;
