import type { OutboundIdentity } from "../../../infra/outbound/identity.js";
import { resolveOutboundSendDep } from "../../../infra/outbound/send-deps.js";
import { getGlobalHookRunner } from "../../../plugins/hook-runner-global.js";
import type { ChannelOutboundAdapter } from "../types.js";
import { sendTextMediaPayload } from "./direct-text-media.js";

type SlackSendIdentity = {
  username?: string;
  iconUrl?: string;
  iconEmoji?: string;
};

type SlackSendOptions = {
  cfg: Parameters<NonNullable<ChannelOutboundAdapter["sendText"]>>[0]["cfg"];
  threadTs?: string;
  accountId?: string;
  mediaUrl?: string;
  mediaLocalRoots?: readonly string[];
  blocks?: unknown[];
  identity?: SlackSendIdentity;
};

type SlackSendResult = {
  messageId: string;
  channelId?: string;
};

type SlackSendFn = (to: string, text: string, opts: SlackSendOptions) => Promise<SlackSendResult>;

function resolveSlackSendIdentity(identity?: OutboundIdentity): SlackSendIdentity | undefined {
  if (!identity) {
    return undefined;
  }
  const username = identity.name?.trim() || undefined;
  const iconUrl = identity.avatarUrl?.trim() || undefined;
  const rawEmoji = identity.emoji?.trim();
  const iconEmoji = !iconUrl && rawEmoji && /^:[^:\s]+:$/.test(rawEmoji) ? rawEmoji : undefined;
  if (!username && !iconUrl && !iconEmoji) {
    return undefined;
  }
  return { username, iconUrl, iconEmoji };
}

function parseSlackBlocksInput(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

async function applySlackMessageSendingHooks(params: {
  to: string;
  text: string;
  threadTs?: string;
  accountId?: string;
  mediaUrl?: string;
}): Promise<{ cancelled: boolean; text: string }> {
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("message_sending")) {
    return { cancelled: false, text: params.text };
  }
  const hookResult = await hookRunner.runMessageSending(
    {
      to: params.to,
      content: params.text,
      metadata: {
        threadTs: params.threadTs,
        channelId: params.to,
        ...(params.mediaUrl ? { mediaUrl: params.mediaUrl } : {}),
      },
    },
    { channelId: "slack", accountId: params.accountId ?? undefined },
  );
  if (hookResult?.cancel) {
    return { cancelled: true, text: params.text };
  }
  return { cancelled: false, text: hookResult?.content ?? params.text };
}

function resolveSlackSender(deps: Record<string, unknown> | null | undefined): SlackSendFn {
  const injected = resolveOutboundSendDep<SlackSendFn>(deps, "slack");
  if (injected) {
    return injected;
  }
  return async () => {
    throw new Error("Slack outbound is unavailable in this trimmed build.");
  };
}

async function sendSlackOutboundMessage(params: {
  cfg: SlackSendOptions["cfg"];
  to: string;
  text: string;
  mediaUrl?: string;
  mediaLocalRoots?: readonly string[];
  blocks?: unknown[];
  accountId?: string | null;
  deps?: { [channelId: string]: unknown } | null;
  replyToId?: string | null;
  threadId?: string | number | null;
  identity?: OutboundIdentity;
}) {
  const send = resolveSlackSender(params.deps);
  const threadTs =
    params.replyToId ?? (params.threadId != null ? String(params.threadId) : undefined);
  const hookResult = await applySlackMessageSendingHooks({
    to: params.to,
    text: params.text,
    threadTs,
    mediaUrl: params.mediaUrl,
    accountId: params.accountId ?? undefined,
  });
  if (hookResult.cancelled) {
    return {
      channel: "slack" as const,
      messageId: "cancelled-by-hook",
      channelId: params.to,
      meta: { cancelled: true },
    };
  }

  const slackIdentity = resolveSlackSendIdentity(params.identity);
  const result = await send(params.to, hookResult.text, {
    cfg: params.cfg,
    threadTs,
    accountId: params.accountId ?? undefined,
    ...(params.mediaUrl
      ? { mediaUrl: params.mediaUrl, mediaLocalRoots: params.mediaLocalRoots }
      : {}),
    ...(params.blocks ? { blocks: params.blocks } : {}),
    ...(slackIdentity ? { identity: slackIdentity } : {}),
  });
  return { channel: "slack" as const, ...result };
}

function resolveSlackBlocks(channelData: Record<string, unknown> | undefined) {
  const slackData = channelData?.slack;
  if (!slackData || typeof slackData !== "object" || Array.isArray(slackData)) {
    return undefined;
  }
  return parseSlackBlocksInput((slackData as { blocks?: unknown }).blocks);
}

export const slackOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: null,
  textChunkLimit: 4000,
  sendPayload: async (ctx) => {
    const blocks = resolveSlackBlocks(ctx.payload.channelData);
    if (!blocks) {
      return await sendTextMediaPayload({ channel: "slack", ctx, adapter: slackOutbound });
    }
    return await sendSlackOutboundMessage({
      cfg: ctx.cfg,
      to: ctx.to,
      text: ctx.payload.text ?? "",
      mediaUrl: ctx.payload.mediaUrl,
      mediaLocalRoots: ctx.mediaLocalRoots,
      blocks,
      accountId: ctx.accountId,
      deps: ctx.deps,
      replyToId: ctx.replyToId,
      threadId: ctx.threadId,
      identity: ctx.identity,
    });
  },
  sendText: async ({ cfg, to, text, accountId, deps, replyToId, threadId, identity }) => {
    return await sendSlackOutboundMessage({
      cfg,
      to,
      text,
      accountId,
      deps,
      replyToId,
      threadId,
      identity,
    });
  },
  sendMedia: async ({
    cfg,
    to,
    text,
    mediaUrl,
    mediaLocalRoots,
    accountId,
    deps,
    replyToId,
    threadId,
    identity,
  }) => {
    return await sendSlackOutboundMessage({
      cfg,
      to,
      text,
      mediaUrl,
      mediaLocalRoots,
      accountId,
      deps,
      replyToId,
      threadId,
      identity,
    });
  },
};
