type ReadChannelAllowFromStoreForAccount = (params: {
    channel: string;
    accountId: string;
    env?: NodeJS.ProcessEnv;
}) => Promise<unknown>;
type UpsertChannelPairingRequestForAccount = (params: {
    channel: string;
    id: string;
    accountId: string;
    meta?: Record<string, unknown>;
    env?: NodeJS.ProcessEnv;
    pairingAdapter?: unknown;
}) => Promise<unknown>;
export type PluginRuntimeChannel = {
    text: {
        chunkByNewline: typeof import("../../auto-reply/chunk.js").chunkByNewline;
        chunkMarkdownText: typeof import("../../auto-reply/chunk.js").chunkMarkdownText;
        chunkMarkdownTextWithMode: typeof import("../../auto-reply/chunk.js").chunkMarkdownTextWithMode;
        chunkText: typeof import("../../auto-reply/chunk.js").chunkText;
        chunkTextWithMode: typeof import("../../auto-reply/chunk.js").chunkTextWithMode;
        resolveChunkMode: typeof import("../../auto-reply/chunk.js").resolveChunkMode;
        resolveTextChunkLimit: typeof import("../../auto-reply/chunk.js").resolveTextChunkLimit;
        hasControlCommand: typeof import("../../auto-reply/command-detection.js").hasControlCommand;
        resolveMarkdownTableMode: typeof import("../../config/markdown-tables.js").resolveMarkdownTableMode;
        convertMarkdownTables: typeof import("../../markdown/tables.js").convertMarkdownTables;
    };
    reply: {
        dispatchReplyWithBufferedBlockDispatcher: typeof import("../../auto-reply/reply/provider-dispatcher.js").dispatchReplyWithBufferedBlockDispatcher;
        createReplyDispatcherWithTyping: typeof import("../../auto-reply/reply/reply-dispatcher.js").createReplyDispatcherWithTyping;
        resolveEffectiveMessagesConfig: typeof import("../../agents/identity.js").resolveEffectiveMessagesConfig;
        resolveHumanDelayConfig: typeof import("../../agents/identity.js").resolveHumanDelayConfig;
        dispatchReplyFromConfig: typeof import("../../auto-reply/reply/dispatch-from-config.js").dispatchReplyFromConfig;
        withReplyDispatcher: typeof import("../../auto-reply/dispatch.js").withReplyDispatcher;
        finalizeInboundContext: typeof import("../../auto-reply/reply/inbound-context.js").finalizeInboundContext;
        formatAgentEnvelope: typeof import("../../auto-reply/envelope.js").formatAgentEnvelope;
        /** @deprecated Prefer `BodyForAgent` + structured user-context blocks (do not build plaintext envelopes for prompts). */
        formatInboundEnvelope: typeof import("../../auto-reply/envelope.js").formatInboundEnvelope;
        resolveEnvelopeFormatOptions: typeof import("../../auto-reply/envelope.js").resolveEnvelopeFormatOptions;
    };
    routing: {
        buildAgentSessionKey: typeof import("../../routing/resolve-route.js").buildAgentSessionKey;
        resolveAgentRoute: typeof import("../../routing/resolve-route.js").resolveAgentRoute;
    };
    pairing: {
        buildPairingReply: (...args: unknown[]) => unknown;
        readAllowFromStore: ReadChannelAllowFromStoreForAccount;
        upsertPairingRequest: UpsertChannelPairingRequestForAccount;
    };
    media: {
        fetchRemoteMedia: typeof import("../../media/fetch.js").fetchRemoteMedia;
        saveMediaBuffer: typeof import("../../media/store.js").saveMediaBuffer;
    };
    activity: {
        record: typeof import("../../infra/channel-activity.js").recordChannelActivity;
        get: typeof import("../../infra/channel-activity.js").getChannelActivity;
    };
    session: {
        resolveStorePath: typeof import("../../config/sessions.js").resolveStorePath;
        readSessionUpdatedAt: typeof import("../../config/sessions.js").readSessionUpdatedAt;
        recordSessionMetaFromInbound: typeof import("../../config/sessions.js").recordSessionMetaFromInbound;
        recordInboundSession: typeof import("../../channels/session.js").recordInboundSession;
        updateLastRoute: typeof import("../../config/sessions.js").updateLastRoute;
    };
    mentions: {
        buildMentionRegexes: typeof import("../../auto-reply/reply/mentions.js").buildMentionRegexes;
        matchesMentionPatterns: typeof import("../../auto-reply/reply/mentions.js").matchesMentionPatterns;
        matchesMentionWithExplicit: typeof import("../../auto-reply/reply/mentions.js").matchesMentionWithExplicit;
    };
    reactions: {
        shouldAckReaction: typeof import("../../channels/ack-reactions.js").shouldAckReaction;
        removeAckReactionAfterReply: typeof import("../../channels/ack-reactions.js").removeAckReactionAfterReply;
    };
    groups: {
        resolveGroupPolicy: typeof import("../../config/group-policy.js").resolveChannelGroupPolicy;
        resolveRequireMention: typeof import("../../config/group-policy.js").resolveChannelGroupRequireMention;
    };
    debounce: {
        createInboundDebouncer: typeof import("../../auto-reply/inbound-debounce.js").createInboundDebouncer;
        resolveInboundDebounceMs: typeof import("../../auto-reply/inbound-debounce.js").resolveInboundDebounceMs;
    };
    commands: {
        resolveCommandAuthorizedFromAuthorizers: typeof import("../../channels/command-gating.js").resolveCommandAuthorizedFromAuthorizers;
        isControlCommandMessage: typeof import("../../auto-reply/command-detection.js").isControlCommandMessage;
        shouldComputeCommandAuthorized: typeof import("../../auto-reply/command-detection.js").shouldComputeCommandAuthorized;
        shouldHandleTextCommands: typeof import("../../auto-reply/commands-registry.js").shouldHandleTextCommands;
    };
    discord: {
        messageActions: typeof import("../../channels/plugins/actions/discord.js").discordMessageActions;
        auditChannelPermissions: (...args: unknown[]) => Promise<unknown>;
        listDirectoryGroupsLive: (...args: unknown[]) => Promise<unknown>;
        listDirectoryPeersLive: (...args: unknown[]) => Promise<unknown>;
        probeDiscord: (...args: unknown[]) => Promise<unknown>;
        resolveChannelAllowlist: (...args: unknown[]) => Promise<unknown>;
        resolveUserAllowlist: (...args: unknown[]) => Promise<unknown>;
        sendMessageDiscord: (...args: unknown[]) => Promise<unknown>;
        sendPollDiscord: (...args: unknown[]) => Promise<unknown>;
        monitorDiscordProvider: (...args: unknown[]) => Promise<unknown>;
    };
    slack: {
        listDirectoryGroupsLive: (...args: unknown[]) => Promise<unknown>;
        listDirectoryPeersLive: (...args: unknown[]) => Promise<unknown>;
        probeSlack: (...args: unknown[]) => Promise<unknown>;
        resolveChannelAllowlist: (...args: unknown[]) => Promise<unknown>;
        resolveUserAllowlist: (...args: unknown[]) => Promise<unknown>;
        sendMessageSlack: (...args: unknown[]) => Promise<unknown>;
        monitorSlackProvider: (...args: unknown[]) => Promise<unknown>;
        handleSlackAction: typeof import("../../agents/tools/slack-actions.js").handleSlackAction;
    };
    telegram: {
        auditGroupMembership: (...args: unknown[]) => Promise<unknown>;
        collectUnmentionedGroupIds: (...args: unknown[]) => Promise<unknown>;
        probeTelegram: (...args: unknown[]) => Promise<unknown>;
        resolveTelegramToken: (...args: unknown[]) => Promise<unknown>;
        sendMessageTelegram: (...args: unknown[]) => Promise<unknown>;
        sendPollTelegram: (...args: unknown[]) => Promise<unknown>;
        monitorTelegramProvider: (...args: unknown[]) => Promise<unknown>;
        messageActions: typeof import("../../channels/plugins/actions/telegram.js").telegramMessageActions;
    };
    signal: {
        probeSignal: (...args: unknown[]) => Promise<unknown>;
        sendMessageSignal: (...args: unknown[]) => Promise<unknown>;
        monitorSignalProvider: (...args: unknown[]) => Promise<unknown>;
        messageActions: typeof import("../../channels/plugins/actions/signal.js").signalMessageActions;
    };
    imessage: {
        monitorIMessageProvider: (...args: unknown[]) => Promise<unknown>;
        probeIMessage: (...args: unknown[]) => Promise<unknown>;
        sendMessageIMessage: (...args: unknown[]) => Promise<unknown>;
    };
    whatsapp: {
        getActiveWebListener: (...args: unknown[]) => unknown;
        getWebAuthAgeMs: (...args: unknown[]) => unknown;
        logoutWeb: (...args: unknown[]) => Promise<unknown>;
        logWebSelfId: (...args: unknown[]) => Promise<unknown>;
        readWebSelfId: (...args: unknown[]) => unknown;
        webAuthExists: (...args: unknown[]) => boolean;
        sendMessageWhatsApp: (...args: unknown[]) => Promise<unknown>;
        sendPollWhatsApp: (...args: unknown[]) => Promise<unknown>;
        loginWeb: (...args: unknown[]) => Promise<unknown>;
        startWebLoginWithQr: (...args: unknown[]) => Promise<unknown>;
        waitForWebLogin: (...args: unknown[]) => Promise<unknown>;
        monitorWebChannel: typeof import("../../channels/web/index.js").monitorWebChannel;
        handleWhatsAppAction: typeof import("../../agents/tools/whatsapp-actions.js").handleWhatsAppAction;
        createLoginTool: typeof import("../../channels/plugins/agent-tools/whatsapp-login.js").createWhatsAppLoginTool;
    };
    line: {
        listLineAccountIds: () => string[];
        resolveDefaultLineAccountId: (...args: unknown[]) => string | undefined;
        resolveLineAccount: (...args: unknown[]) => unknown;
        normalizeAccountId: (accountId?: string | null) => string;
        probeLineBot: (...args: unknown[]) => Promise<unknown>;
        sendMessageLine: (...args: unknown[]) => Promise<unknown>;
        pushMessageLine: (...args: unknown[]) => Promise<unknown>;
        pushMessagesLine: (...args: unknown[]) => Promise<unknown>;
        pushFlexMessage: (...args: unknown[]) => Promise<unknown>;
        pushTemplateMessage: (...args: unknown[]) => Promise<unknown>;
        pushLocationMessage: (...args: unknown[]) => Promise<unknown>;
        pushTextMessageWithQuickReplies: (...args: unknown[]) => Promise<unknown>;
        createQuickReplyItems: (...args: unknown[]) => unknown;
        buildTemplateMessageFromPayload: (...args: unknown[]) => unknown;
        monitorLineProvider: (...args: unknown[]) => Promise<unknown>;
    };
};
export {};
