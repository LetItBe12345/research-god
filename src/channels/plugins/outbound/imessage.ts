import {
  resolveOutboundSendDep,
  type OutboundSendDeps,
} from "../../../infra/outbound/send-deps.js";
import {
  createScopedChannelMediaMaxBytesResolver,
  createDirectTextMediaOutbound,
} from "./direct-text-media.js";

type IMessageSendResult = {
  messageId: string;
  chatId?: string;
};

type IMessageSendFn = (
  to: string,
  text: string,
  opts: {
    config: Parameters<NonNullable<ReturnType<typeof createDirectTextMediaOutbound>["sendText"]>>[0]["cfg"];
    maxBytes?: number;
    accountId?: string;
    replyToId?: string;
    mediaUrl?: string;
    mediaLocalRoots?: readonly string[];
  },
) => Promise<IMessageSendResult>;

function resolveIMessageSender(deps: OutboundSendDeps | undefined): IMessageSendFn {
  const injected = resolveOutboundSendDep<IMessageSendFn>(deps, "imessage");
  if (injected) {
    return injected;
  }
  return async () => {
    throw new Error("iMessage outbound is unavailable in this trimmed build.");
  };
}

export const imessageOutbound = createDirectTextMediaOutbound({
  channel: "imessage",
  resolveSender: resolveIMessageSender,
  resolveMaxBytes: createScopedChannelMediaMaxBytesResolver("imessage"),
  buildTextOptions: ({ cfg, maxBytes, accountId, replyToId }) => ({
    config: cfg,
    maxBytes,
    accountId: accountId ?? undefined,
    replyToId: replyToId ?? undefined,
  }),
  buildMediaOptions: ({ cfg, mediaUrl, maxBytes, accountId, replyToId, mediaLocalRoots }) => ({
    config: cfg,
    mediaUrl,
    maxBytes,
    accountId: accountId ?? undefined,
    replyToId: replyToId ?? undefined,
    mediaLocalRoots,
  }),
});
