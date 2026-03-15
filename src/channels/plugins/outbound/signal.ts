import {
  resolveOutboundSendDep,
  type OutboundSendDeps,
} from "../../../infra/outbound/send-deps.js";
import {
  createScopedChannelMediaMaxBytesResolver,
  createDirectTextMediaOutbound,
} from "./direct-text-media.js";

type SignalSendResult = {
  messageId: string;
  timestamp?: number;
  toJid?: string;
};

type SignalSendFn = (
  to: string,
  text: string,
  opts: {
    cfg: Parameters<NonNullable<ReturnType<typeof createDirectTextMediaOutbound>["sendText"]>>[0]["cfg"];
    maxBytes?: number;
    accountId?: string;
    mediaUrl?: string;
    mediaLocalRoots?: readonly string[];
  },
) => Promise<SignalSendResult>;

function resolveSignalSender(deps: OutboundSendDeps | undefined): SignalSendFn {
  const injected = resolveOutboundSendDep<SignalSendFn>(deps, "signal");
  if (injected) {
    return injected;
  }
  return async () => {
    throw new Error("Signal outbound is unavailable in this trimmed build.");
  };
}

export const signalOutbound = createDirectTextMediaOutbound({
  channel: "signal",
  resolveSender: resolveSignalSender,
  resolveMaxBytes: createScopedChannelMediaMaxBytesResolver("signal"),
  buildTextOptions: ({ cfg, maxBytes, accountId }) => ({
    cfg,
    maxBytes,
    accountId: accountId ?? undefined,
  }),
  buildMediaOptions: ({ cfg, mediaUrl, maxBytes, accountId, mediaLocalRoots }) => ({
    cfg,
    mediaUrl,
    maxBytes,
    accountId: accountId ?? undefined,
    mediaLocalRoots,
  }),
});
