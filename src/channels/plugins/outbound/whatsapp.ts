import { chunkByParagraph, chunkText } from "../../../auto-reply/chunk.js";
import {
  resolveOutboundSendDep,
  type OutboundSendDeps,
} from "../../../infra/outbound/send-deps.js";
import { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "../../../whatsapp/normalize.js";
import { resolveWhatsAppOutboundTarget } from "../../../whatsapp/resolve-outbound-target.js";
import type { ChannelOutboundAdapter } from "../types.js";

type WhatsAppSendResult = {
  messageId: string;
  toJid?: string;
};

type WhatsAppSendFn = (
  to: string,
  text: string,
  opts: {
    cfg: Parameters<NonNullable<ChannelOutboundAdapter["sendText"]>>[0]["cfg"];
    accountId?: string;
    replyToId?: string;
    mediaUrl?: string;
    mediaLocalRoots?: readonly string[];
    verbose: boolean;
  },
) => Promise<WhatsAppSendResult>;

function resolveWhatsAppSender(deps: OutboundSendDeps | undefined): WhatsAppSendFn {
  const injected = resolveOutboundSendDep<WhatsAppSendFn>(deps, "whatsapp");
  if (injected) {
    return injected;
  }
  return async () => {
    throw new Error("WhatsApp outbound is unavailable in this trimmed build.");
  };
}

export const whatsappOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  chunker: chunkText,
  chunkerMode: "text",
  textChunkLimit: 4000,
  resolveTarget: ({ to, allowFrom, mode }) => {
    const normalizedAllowFrom = (allowFrom ?? [])
      .map((entry) => normalizeWhatsAppTarget(entry))
      .filter((entry): entry is string => Boolean(entry));
    const normalizedTarget = normalizeWhatsAppTarget(to)?.toLowerCase();
    if (normalizedTarget && isWhatsAppGroupJid(normalizedTarget)) {
      return { ok: true, to: normalizedTarget };
    }
    return resolveWhatsAppOutboundTarget({
      to: normalizedTarget,
      allowFrom: normalizedAllowFrom,
      mode,
    });
  },
  sendText: async ({ cfg, to, text, accountId, deps, replyToId }) => {
    const send = resolveWhatsAppSender(deps);
    const result = await send(to, text, {
      cfg,
      accountId: accountId ?? undefined,
      replyToId: replyToId ?? undefined,
      verbose: false,
    });
    return { channel: "whatsapp", ...result };
  },
  sendMedia: async ({ cfg, to, text, mediaUrl, mediaLocalRoots, accountId, deps, replyToId }) => {
    const send = resolveWhatsAppSender(deps);
    const result = await send(to, text, {
      cfg,
      mediaUrl,
      mediaLocalRoots,
      accountId: accountId ?? undefined,
      replyToId: replyToId ?? undefined,
      verbose: false,
    });
    return { channel: "whatsapp", ...result };
  },
  sendPayload: async (ctx) => {
    const mediaUrls = ctx.payload.mediaUrls?.length
      ? ctx.payload.mediaUrls
      : ctx.payload.mediaUrl
        ? [ctx.payload.mediaUrl]
        : [];
    if (mediaUrls.length > 0) {
      let lastResult: Awaited<ReturnType<NonNullable<ChannelOutboundAdapter["sendMedia"]>>> = {
        channel: "whatsapp",
        messageId: "",
      };
      for (let i = 0; i < mediaUrls.length; i += 1) {
        const mediaUrl = mediaUrls[i];
        if (!mediaUrl) {
          continue;
        }
        lastResult = await whatsappOutbound.sendMedia!({
          ...ctx,
          text: i === 0 ? (ctx.payload.text ?? "") : "",
          mediaUrl,
        });
      }
      return lastResult;
    }

    const text = ctx.payload.text ?? "";
    const chunkMode = ctx.cfg.channels?.whatsapp?.chunkMode;
    const chunkLimit = ctx.cfg.channels?.whatsapp?.textChunkLimit ?? whatsappOutbound.textChunkLimit!;
    const chunks =
      chunkMode === "newline" ? chunkByParagraph(text, chunkLimit) : whatsappOutbound.chunker!(text, chunkLimit);

    let lastResult: Awaited<ReturnType<NonNullable<ChannelOutboundAdapter["sendText"]>>> = {
      channel: "whatsapp",
      messageId: "",
    };
    for (const chunk of chunks) {
      lastResult = await whatsappOutbound.sendText!({
        ...ctx,
        text: chunk,
      });
    }
    return lastResult;
  },
};
