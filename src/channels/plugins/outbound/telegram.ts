import { resolveOutboundSendDep } from "../../../infra/outbound/send-deps.js";
import {
  looksLikeTelegramTargetId,
  normalizeTelegramMessagingTarget,
} from "../normalize/telegram.js";
import type { ChannelOutboundAdapter } from "../types.js";

type TelegramButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type TelegramSendResult = {
  messageId: string;
  chatId?: string;
};

type TelegramSendOptions = {
  cfg: Parameters<NonNullable<ChannelOutboundAdapter["sendText"]>>[0]["cfg"];
  accountId?: string;
  replyToMessageId?: string;
  messageThreadId?: number;
  mediaUrl?: string;
  mediaLocalRoots?: readonly string[];
  buttons?: TelegramButton[][];
  textMode?: "html" | "plain";
};

type TelegramSendFn = (
  to: string,
  text: string,
  opts: TelegramSendOptions,
) => Promise<TelegramSendResult>;

function parseTelegramThreadId(value?: string | number | null): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseTelegramReplyToMessageId(value?: string | number | null): string | undefined {
  if (value == null) {
    return undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
}

export function resolveTelegramSendOptions(params: {
  cfg: TelegramSendOptions["cfg"];
  accountId?: string | null;
  replyToId?: string | null;
  threadId?: string | number | null;
  mediaUrl?: string;
  mediaLocalRoots?: readonly string[];
  buttons?: TelegramButton[][];
}): TelegramSendOptions {
  return {
    cfg: params.cfg,
    accountId: params.accountId ?? undefined,
    replyToMessageId: parseTelegramReplyToMessageId(params.replyToId),
    messageThreadId: parseTelegramThreadId(params.threadId),
    mediaUrl: params.mediaUrl,
    mediaLocalRoots: params.mediaLocalRoots,
    buttons: params.buttons,
    textMode: "html",
  };
}

function resolveTelegramSender(deps: Record<string, unknown> | null | undefined): TelegramSendFn {
  const injected = resolveOutboundSendDep<TelegramSendFn>(deps, "telegram");
  if (injected) {
    return injected;
  }
  return async () => {
    throw new Error("Telegram outbound is unavailable in this trimmed build.");
  };
}

function readTelegramButtons(channelData: Record<string, unknown> | undefined): TelegramButton[][] | undefined {
  const telegram = channelData?.telegram;
  if (!telegram || typeof telegram !== "object" || Array.isArray(telegram)) {
    return undefined;
  }
  const buttons = (telegram as { buttons?: TelegramButton[][] }).buttons;
  return Array.isArray(buttons) ? buttons : undefined;
}

async function sendTelegramMessage(params: {
  to: string;
  text: string;
  cfg: TelegramSendOptions["cfg"];
  accountId?: string | null;
  replyToId?: string | null;
  threadId?: string | number | null;
  mediaUrl?: string;
  mediaLocalRoots?: readonly string[];
  buttons?: TelegramButton[][];
  deps?: Record<string, unknown> | null;
}): Promise<{ channel: "telegram"; messageId: string; chatId?: string }> {
  const send = resolveTelegramSender(params.deps);
  const result = await send(
    params.to,
    params.text,
    resolveTelegramSendOptions({
      cfg: params.cfg,
      accountId: params.accountId,
      replyToId: params.replyToId,
      threadId: params.threadId,
      mediaUrl: params.mediaUrl,
      mediaLocalRoots: params.mediaLocalRoots,
      buttons: params.buttons,
    }),
  );
  return { channel: "telegram", ...result };
}

export async function sendTelegramPayloadMessages(
  ctx: Parameters<NonNullable<ChannelOutboundAdapter["sendPayload"]>>[0],
) {
  return await telegramOutbound.sendPayload!(ctx);
}

export const telegramOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  resolveTarget: ({ to }) => {
    const normalized = to ? normalizeTelegramMessagingTarget(to) : undefined;
    if (!normalized || !looksLikeTelegramTargetId(normalized)) {
      return { ok: false, error: new Error("Invalid Telegram target") };
    }
    return { ok: true, to: normalized };
  },
  sendText: async ({ cfg, to, text, accountId, deps, replyToId, threadId }) => {
    return await sendTelegramMessage({
      cfg,
      to,
      text,
      accountId,
      deps,
      replyToId,
      threadId,
    });
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, mediaLocalRoots, accountId, deps, replyToId, threadId }) => {
    return await sendTelegramMessage({
      cfg,
      to,
      text,
      mediaUrl,
      mediaLocalRoots,
      accountId,
      deps,
      replyToId,
      threadId,
    });
  },
  sendPayload: async (ctx) => {
    const text = ctx.payload.text ?? "";
    const mediaUrls = ctx.payload.mediaUrls?.length
      ? ctx.payload.mediaUrls
      : ctx.payload.mediaUrl
        ? [ctx.payload.mediaUrl]
        : [];
    const buttons = readTelegramButtons(ctx.payload.channelData);

    if (mediaUrls.length > 0) {
      let lastResult: Awaited<ReturnType<NonNullable<ChannelOutboundAdapter["sendMedia"]>>> = {
        channel: "telegram",
        messageId: "",
      };
      for (let i = 0; i < mediaUrls.length; i += 1) {
        const mediaUrl = mediaUrls[i];
        if (!mediaUrl) {
          continue;
        }
        lastResult = await sendTelegramMessage({
          cfg: ctx.cfg,
          to: ctx.to,
          text: i === 0 ? text : "",
          mediaUrl,
          mediaLocalRoots: ctx.mediaLocalRoots,
          accountId: ctx.accountId,
          deps: ctx.deps ?? null,
          replyToId: ctx.replyToId,
          threadId: ctx.threadId,
          buttons: i === 0 ? buttons : undefined,
        });
      }
      return lastResult;
    }

    return await sendTelegramMessage({
      cfg: ctx.cfg,
      to: ctx.to,
      text,
      accountId: ctx.accountId,
      deps: ctx.deps ?? null,
      replyToId: ctx.replyToId,
      threadId: ctx.threadId,
      buttons,
    });
  },
};
