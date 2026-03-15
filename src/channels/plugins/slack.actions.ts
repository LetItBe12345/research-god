import { handleSlackAction, type SlackActionContext } from "../../agents/tools/slack-actions.js";
import { handleSlackMessageAction } from "../../plugin-sdk/slack-message-actions.js";
import type { ChannelMessageActionAdapter } from "./types.js";

function listSlackMessageActions(): string[] {
  return ["send", "react", "reactions", "read", "edit", "delete", "pin", "unpin", "list-pins"];
}

function extractSlackToolSend(_args: Record<string, unknown>) {
  return undefined;
}

function resolveSlackChannelId(channelId: string): string {
  const trimmed = channelId.trim();
  return trimmed.replace(/^slack:/i, "");
}

export function createSlackActions(providerId: string): ChannelMessageActionAdapter {
  return {
    listActions: () => listSlackMessageActions(),
    extractToolSend: ({ args }) => extractSlackToolSend(args),
    handleAction: async (ctx) => {
      return await handleSlackMessageAction({
        providerId,
        ctx,
        normalizeChannelId: resolveSlackChannelId,
        includeReadThreadId: true,
        invoke: async (action, cfg, toolContext) =>
          await handleSlackAction(action, cfg, {
            ...(toolContext as SlackActionContext | undefined),
            mediaLocalRoots: ctx.mediaLocalRoots,
          }),
      });
    },
  };
}
