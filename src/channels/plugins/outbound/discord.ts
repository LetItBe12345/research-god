import { resolveOutboundSendDep } from "../../../infra/outbound/send-deps.js";
import { buildDiscordSendMediaOptions, buildDiscordSendOptions } from "../../../plugin-sdk/discord-send.js";
import { normalizeDiscordMessagingTarget } from "../normalize/discord.js";
import type { ChannelOutboundAdapter } from "../types.js";

type DiscordSendResult = {
  messageId: string;
  channelId?: string;
};

type DiscordSendFn = (
  to: string,
  text: string,
  opts: ReturnType<typeof buildDiscordSendOptions> | ReturnType<typeof buildDiscordSendMediaOptions>,
) => Promise<DiscordSendResult>;

function resolveDiscordSender(deps: Record<string, unknown> | null | undefined): DiscordSendFn {
  const injected = resolveOutboundSendDep<DiscordSendFn>(deps, "discord");
  if (injected) {
    return injected;
  }
  return async () => {
    throw new Error("Discord outbound is unavailable in this trimmed build.");
  };
}

export const discordOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  resolveTarget: ({ to }) => {
    const normalized = to ? normalizeDiscordMessagingTarget(to) : undefined;
    if (!normalized) {
      return { ok: false, error: new Error("Invalid Discord target") };
    }
    return { ok: true, to: normalized };
  },
  sendText: async ({ to, text, accountId, deps, replyToId, silent }) => {
    const send = resolveDiscordSender(deps);
    const result = await send(to, text, buildDiscordSendOptions({ accountId, replyToId, silent }));
    return { channel: "discord", ...result };
  },
  sendMedia: async ({ to, text, mediaUrl, mediaLocalRoots, accountId, deps, replyToId, silent }) => {
    const send = resolveDiscordSender(deps);
    const result = await send(
      to,
      text,
      buildDiscordSendMediaOptions({
        accountId,
        replyToId,
        silent,
        mediaUrl,
        mediaLocalRoots,
      }),
    );
    return { channel: "discord", ...result };
  },
};
