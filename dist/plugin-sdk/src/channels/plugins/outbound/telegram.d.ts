import type { ChannelOutboundAdapter } from "../types.js";
type TelegramButton = {
    text: string;
    callback_data?: string;
    url?: string;
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
export declare function parseTelegramReplyToMessageId(value?: string | number | null): string | undefined;
export declare function resolveTelegramSendOptions(params: {
    cfg: TelegramSendOptions["cfg"];
    accountId?: string | null;
    replyToId?: string | null;
    threadId?: string | number | null;
    mediaUrl?: string;
    mediaLocalRoots?: readonly string[];
    buttons?: TelegramButton[][];
}): TelegramSendOptions;
export declare function sendTelegramPayloadMessages(ctx: Parameters<NonNullable<ChannelOutboundAdapter["sendPayload"]>>[0]): Promise<import("../../../plugin-sdk/twitch.ts").OutboundDeliveryResult>;
export declare const telegramOutbound: ChannelOutboundAdapter;
export {};
