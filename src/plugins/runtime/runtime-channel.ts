import { resolveEffectiveMessagesConfig, resolveHumanDelayConfig } from "../../agents/identity.js";
import {
  chunkByNewline,
  chunkMarkdownText,
  chunkMarkdownTextWithMode,
  chunkText,
  chunkTextWithMode,
  resolveChunkMode,
  resolveTextChunkLimit,
} from "../../auto-reply/chunk.js";
import {
  hasControlCommand,
  isControlCommandMessage,
  shouldComputeCommandAuthorized,
} from "../../auto-reply/command-detection.js";
import { shouldHandleTextCommands } from "../../auto-reply/commands-registry.js";
import { withReplyDispatcher } from "../../auto-reply/dispatch.js";
import {
  formatAgentEnvelope,
  formatInboundEnvelope,
  resolveEnvelopeFormatOptions,
} from "../../auto-reply/envelope.js";
import {
  createInboundDebouncer,
  resolveInboundDebounceMs,
} from "../../auto-reply/inbound-debounce.js";
import { dispatchReplyFromConfig } from "../../auto-reply/reply/dispatch-from-config.js";
import { finalizeInboundContext } from "../../auto-reply/reply/inbound-context.js";
import {
  buildMentionRegexes,
  matchesMentionPatterns,
  matchesMentionWithExplicit,
} from "../../auto-reply/reply/mentions.js";
import { dispatchReplyWithBufferedBlockDispatcher } from "../../auto-reply/reply/provider-dispatcher.js";
import { createReplyDispatcherWithTyping } from "../../auto-reply/reply/reply-dispatcher.js";
import { removeAckReactionAfterReply, shouldAckReaction } from "../../channels/ack-reactions.js";
import { resolveCommandAuthorizedFromAuthorizers } from "../../channels/command-gating.js";
import { recordInboundSession } from "../../channels/session.js";
import {
  resolveChannelGroupPolicy,
  resolveChannelGroupRequireMention,
} from "../../config/group-policy.js";
import { resolveMarkdownTableMode } from "../../config/markdown-tables.js";
import {
  readSessionUpdatedAt,
  recordSessionMetaFromInbound,
  resolveStorePath,
  updateLastRoute,
} from "../../config/sessions.js";
import { getChannelActivity, recordChannelActivity } from "../../infra/channel-activity.js";
import { convertMarkdownTables } from "../../markdown/tables.js";
import { fetchRemoteMedia } from "../../media/fetch.js";
import { saveMediaBuffer } from "../../media/store.js";
import { buildAgentSessionKey, resolveAgentRoute } from "../../routing/resolve-route.js";
import { createRuntimeWhatsApp } from "./runtime-whatsapp.js";
import type { PluginRuntime } from "./types.js";

const unsupported = (feature: string): never => {
  throw new Error(`${feature} is unavailable in this trimmed build.`);
};

function createUnsupportedChannelRuntime<T>(feature: string): T {
  const reject = async () => unsupported(feature);
  return {
    messageActions: {},
    auditChannelPermissions: reject,
    listDirectoryGroupsLive: reject,
    listDirectoryPeersLive: reject,
    probeDiscord: reject,
    resolveChannelAllowlist: reject,
    resolveUserAllowlist: reject,
    sendMessageDiscord: reject,
    sendPollDiscord: reject,
    monitorDiscordProvider: reject,
    probeSlack: reject,
    sendMessageSlack: reject,
    monitorSlackProvider: reject,
    handleSlackAction: reject,
    auditGroupMembership: reject,
    collectUnmentionedGroupIds: reject,
    probeTelegram: reject,
    resolveTelegramToken: reject,
    sendMessageTelegram: reject,
    sendPollTelegram: reject,
    monitorTelegramProvider: reject,
    probeSignal: reject,
    sendMessageSignal: reject,
    monitorSignalProvider: reject,
    probeIMessage: reject,
    sendMessageIMessage: reject,
    monitorIMessageProvider: reject,
  } as T;
}

function createUnavailablePairingRuntime(): PluginRuntime["channel"]["pairing"] {
  const reject = async () => unsupported("Pairing");
  return {
    buildPairingReply: (() => unsupported("Pairing")) as PluginRuntime["channel"]["pairing"]["buildPairingReply"],
    readAllowFromStore: reject as PluginRuntime["channel"]["pairing"]["readAllowFromStore"],
    upsertPairingRequest: reject as PluginRuntime["channel"]["pairing"]["upsertPairingRequest"],
  };
}

function createUnavailableLineRuntime(): PluginRuntime["channel"]["line"] {
  const reject = async () => unsupported("LINE");
  return {
    listLineAccountIds: (() => []) as PluginRuntime["channel"]["line"]["listLineAccountIds"],
    resolveDefaultLineAccountId: (() => undefined) as PluginRuntime["channel"]["line"]["resolveDefaultLineAccountId"],
    resolveLineAccount: (() => unsupported("LINE")) as PluginRuntime["channel"]["line"]["resolveLineAccount"],
    normalizeAccountId: ((accountId?: string | null) => (accountId ?? "").trim()) as PluginRuntime["channel"]["line"]["normalizeAccountId"],
    probeLineBot: reject as PluginRuntime["channel"]["line"]["probeLineBot"],
    sendMessageLine: reject as PluginRuntime["channel"]["line"]["sendMessageLine"],
    pushMessageLine: reject as PluginRuntime["channel"]["line"]["pushMessageLine"],
    pushMessagesLine: reject as PluginRuntime["channel"]["line"]["pushMessagesLine"],
    pushFlexMessage: reject as PluginRuntime["channel"]["line"]["pushFlexMessage"],
    pushTemplateMessage: reject as PluginRuntime["channel"]["line"]["pushTemplateMessage"],
    pushLocationMessage: reject as PluginRuntime["channel"]["line"]["pushLocationMessage"],
    pushTextMessageWithQuickReplies:
      reject as PluginRuntime["channel"]["line"]["pushTextMessageWithQuickReplies"],
    createQuickReplyItems:
      (() => unsupported("LINE")) as PluginRuntime["channel"]["line"]["createQuickReplyItems"],
    buildTemplateMessageFromPayload:
      (() => unsupported("LINE")) as PluginRuntime["channel"]["line"]["buildTemplateMessageFromPayload"],
    monitorLineProvider: reject as PluginRuntime["channel"]["line"]["monitorLineProvider"],
  };
}

export function createRuntimeChannel(): PluginRuntime["channel"] {
  return {
    text: {
      chunkByNewline,
      chunkMarkdownText,
      chunkMarkdownTextWithMode,
      chunkText,
      chunkTextWithMode,
      resolveChunkMode,
      resolveTextChunkLimit,
      hasControlCommand,
      resolveMarkdownTableMode,
      convertMarkdownTables,
    },
    reply: {
      dispatchReplyWithBufferedBlockDispatcher,
      createReplyDispatcherWithTyping,
      resolveEffectiveMessagesConfig,
      resolveHumanDelayConfig,
      dispatchReplyFromConfig,
      withReplyDispatcher,
      finalizeInboundContext,
      formatAgentEnvelope,
      /** @deprecated Prefer `BodyForAgent` + structured user-context blocks (do not build plaintext envelopes for prompts). */
      formatInboundEnvelope,
      resolveEnvelopeFormatOptions,
    },
    routing: {
      buildAgentSessionKey,
      resolveAgentRoute,
    },
    pairing: createUnavailablePairingRuntime(),
    media: {
      fetchRemoteMedia,
      saveMediaBuffer,
    },
    activity: {
      record: recordChannelActivity,
      get: getChannelActivity,
    },
    session: {
      resolveStorePath,
      readSessionUpdatedAt,
      recordSessionMetaFromInbound,
      recordInboundSession,
      updateLastRoute,
    },
    mentions: {
      buildMentionRegexes,
      matchesMentionPatterns,
      matchesMentionWithExplicit,
    },
    reactions: {
      shouldAckReaction,
      removeAckReactionAfterReply,
    },
    groups: {
      resolveGroupPolicy: resolveChannelGroupPolicy,
      resolveRequireMention: resolveChannelGroupRequireMention,
    },
    debounce: {
      createInboundDebouncer,
      resolveInboundDebounceMs,
    },
    commands: {
      resolveCommandAuthorizedFromAuthorizers,
      isControlCommandMessage,
      shouldComputeCommandAuthorized,
      shouldHandleTextCommands,
    },
    discord: createUnsupportedChannelRuntime<PluginRuntime["channel"]["discord"]>("Discord"),
    slack: createUnsupportedChannelRuntime<PluginRuntime["channel"]["slack"]>("Slack"),
    telegram: createUnsupportedChannelRuntime<PluginRuntime["channel"]["telegram"]>("Telegram"),
    signal: createUnsupportedChannelRuntime<PluginRuntime["channel"]["signal"]>("Signal"),
    imessage: createUnsupportedChannelRuntime<PluginRuntime["channel"]["imessage"]>("iMessage"),
    whatsapp: createRuntimeWhatsApp(),
    line: createUnavailableLineRuntime(),
  };
}
