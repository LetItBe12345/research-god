import { handleDiscordAction } from "../../../agents/tools/discord-actions.js";
import type { ChannelMessageActionAdapter, ChannelMessageActionName } from "../types.js";
import { handleDiscordMessageAction } from "./discord/handle-action.js";

const DEFAULT_DISCORD_ACTIONS: ChannelMessageActionName[] = [
  "send",
  "react",
  "reactions",
  "emoji-upload",
  "sticker-upload",
  "channel-create",
  "channel-edit",
  "channel-delete",
  "category-create",
  "category-edit",
  "category-delete",
  "channel-permission-set",
  "channel-permission-remove",
  "timeout",
  "kick",
  "ban",
];

export const discordMessageActions: ChannelMessageActionAdapter = {
  listActions: ({ cfg, accountId }) => {
    const root = cfg.channels?.discord;
    const account =
      (accountId ? root?.accounts?.[accountId] : undefined) ?? root?.accounts?.default ?? undefined;
    const rootActions = (root?.actions as Record<string, unknown> | undefined) ?? {};
    const accountActions = (account?.actions as Record<string, unknown> | undefined) ?? {};
    const mergedGate = (key: string, defaultValue: boolean) => {
      const rootValue = rootActions[key];
      const accountValue = accountActions[key];
      if (accountValue !== undefined) {
        return accountValue !== false;
      }
      if (rootValue !== undefined) {
        return rootValue !== false;
      }
      return defaultValue;
    };
    const anyAccountEnablesModeration =
      Object.values(root?.accounts ?? {}).some(
        (entry) => (entry as { actions?: Record<string, unknown> }).actions?.moderation === true,
      ) || accountActions.moderation === true;
    const anyAccountEnablesChannels =
      Object.values(root?.accounts ?? {}).some(
        (entry) => (entry as { actions?: Record<string, unknown> }).actions?.channels === true,
      ) || accountActions.channels === true;
    return DEFAULT_DISCORD_ACTIONS.filter((action) => {
      if (action.startsWith("channel-") || action.startsWith("category-")) {
        if (rootActions.channels === false && anyAccountEnablesChannels) {
          return true;
        }
        return mergedGate("channels", true);
      }
      if (action === "timeout" || action === "kick" || action === "ban") {
        return mergedGate("moderation", anyAccountEnablesModeration ? true : false);
      }
      return true;
    });
  },
  supportsAction: () => true,
  handleAction: async (ctx) =>
    await handleDiscordMessageAction({
      ...ctx,
      invoke: handleDiscordAction,
    }),
};
