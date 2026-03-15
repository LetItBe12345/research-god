import { handleTelegramAction } from "../../../agents/tools/telegram-actions.js";
import {
  readNumberParam,
  readStringArrayParam,
  readStringOrNumberParam,
  readStringParam,
} from "../../../agents/tools/common.js";
import type { ChannelMessageActionAdapter, ChannelMessageActionName } from "../types.js";
import { resolveReactionMessageId } from "./reaction-message-id.js";

const DEFAULT_TELEGRAM_ACTIONS: ChannelMessageActionName[] = [
  "send",
  "react",
  "poll",
  "edit",
  "delete",
  "topic-create",
  "sticker",
  "sticker-search",
];

export const telegramMessageActions: ChannelMessageActionAdapter = {
  listActions: ({ cfg, accountId }) => {
    const root = cfg.channels?.telegram;
    const account =
      (accountId ? root?.accounts?.[accountId] : undefined) ?? root?.accounts?.default ?? root;
    const actions = (account?.actions as Record<string, unknown> | undefined) ?? {};
    const rootActions = (root?.actions as Record<string, unknown> | undefined) ?? {};
    const gate = (key: string, defaultValue = true) => {
      const accountValue = actions[key];
      if (accountValue !== undefined) {return accountValue !== false;}
      const rootValue = rootActions[key];
      if (rootValue !== undefined) {return rootValue !== false;}
      return defaultValue;
    };
    const accountEntries = Object.values(root?.accounts ?? {}) as Array<{ actions?: Record<string, unknown> }>;
    const rootAllowsSend = gate("sendMessage");
    const rootAllowsPoll = gate("poll");
    const anyAccountCanSendAndPoll = accountEntries.some((entry) => {
      const actions = entry.actions ?? {};
      const sendAllowed = actions.sendMessage !== undefined ? actions.sendMessage !== false : rootAllowsSend;
      const pollAllowed = actions.poll !== undefined ? actions.poll !== false : rootAllowsPoll;
      return sendAllowed && pollAllowed;
    });
    const canSend = rootAllowsSend;
    const canPoll = accountEntries.length > 0 ? anyAccountCanSendAndPoll : rootAllowsPoll && rootAllowsSend;
    const canSticker =
      gate("sticker", false) ||
      accountEntries.some((entry) => {
        const value = entry.actions?.sticker;
        return value === true;
      });
    return DEFAULT_TELEGRAM_ACTIONS.filter((action) => {
      if (action === "react") {
        return gate("reactions");
      }
      if (action === "poll") {
        return canPoll;
      }
      if (action === "sticker" || action === "sticker-search") {
        return canSticker;
      }
      return true;
    });
  },
  handleAction: async ({ action, params, cfg, accountId, mediaLocalRoots, toolContext }) => {
    const mappedAccountId = accountId ?? readStringParam(params, "accountId");
    let mapped: Record<string, unknown>;
    switch (action) {
      case "send":
        mapped = {
          action: "sendMessage",
          to: readStringParam(params, "to", { required: true }),
          content: readStringParam(params, "message", { allowEmpty: true }) ?? "",
          mediaUrl: readStringParam(params, "media", { trim: false }),
          asVoice: params.asVoice,
          silent: params.silent === true || params.silent === "true" ? true : undefined,
          accountId: mappedAccountId,
        };
        break;
      case "edit": {
        const messageId = readNumberParam(params, "messageId", { integer: true, strict: true });
        if (messageId === undefined) {
          throw new Error("messageId required");
        }
        mapped = {
          action: "editMessage",
          chatId: readStringOrNumberParam(params, "chatId", { required: true }),
          messageId,
          content: readStringParam(params, "message", { allowEmpty: true }) ?? "",
          buttons: params.buttons ?? [],
          accountId: mappedAccountId,
        };
        break;
      }
      case "poll":
        mapped = {
          action: "poll",
          to: readStringParam(params, "to", { required: true }),
          question: readStringParam(params, "pollQuestion", { required: true }),
          answers: readStringArrayParam(params, "pollOption", { required: true }),
          allowMultiselect: params.pollMulti === true || params.pollMulti === "true" ? true : undefined,
          durationHours: typeof params.pollDurationHours === "number" ? params.pollDurationHours : undefined,
          durationSeconds: typeof params.pollDurationSeconds === "number" ? params.pollDurationSeconds : undefined,
          replyToMessageId: readNumberParam(params, "replyTo", { integer: true }),
          messageThreadId: readNumberParam(params, "threadId", { integer: true }),
          isAnonymous: params.pollPublic === true || params.pollPublic === "true" ? false : undefined,
          silent: params.silent === true || params.silent === "true" ? true : undefined,
          accountId: mappedAccountId,
        };
        break;
      case "topic-create":
        mapped = {
          action: "createForumTopic",
          chatId: readStringParam(params, "to", { required: true }),
          name: readStringParam(params, "name", { required: true }),
          iconColor: params.iconColor,
          iconCustomEmojiId: params.iconCustomEmojiId,
          accountId: mappedAccountId,
        };
        break;
      case "react":
        mapped = {
          action: "react",
          chatId:
            readStringOrNumberParam(params, "chatId") ??
            readStringOrNumberParam(params, "channelId", { required: true }),
          messageId: resolveReactionMessageId({
            args: params,
            toolContext: toolContext as { currentMessageId?: string | number } | undefined,
          }),
          emoji: readStringParam(params, "emoji", { required: true }),
          accountId: mappedAccountId,
        };
        break;
      default:
        mapped = { ...params, action, accountId: mappedAccountId };
    }
    return await handleTelegramAction(mapped, cfg, { mediaLocalRoots });
  },
};
