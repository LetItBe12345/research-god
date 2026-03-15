import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { readNumberParam, readStringArrayParam, readStringParam } from "../../../../agents/tools/common.js";
import type { ChannelMessageActionContext } from "../../types.js";
import { resolveReactionMessageId } from "../reaction-message-id.js";

export async function handleDiscordMessageAction(
  params: ChannelMessageActionContext & {
    invoke?: (params: Record<string, unknown>, cfg: ChannelMessageActionContext["cfg"], options?: {
      mediaLocalRoots?: readonly string[];
    }) => Promise<AgentToolResult<unknown>>;
  },
): Promise<AgentToolResult<unknown>> {
  const invoke =
    params.invoke ??
    (async (action, cfg, options) => await import("../../../../agents/tools/discord-actions.js").then((m) => m.handleDiscordAction(action, cfg, options)));

  const accountId = params.accountId ?? readStringParam(params.params, "accountId");
  const actionParams = params.params;
  let mapped: Record<string, unknown>;

  switch (params.action) {
    case "send":
      mapped = {
        action: "sendMessage",
        to: readStringParam(actionParams, "to", { required: true }),
        content: readStringParam(actionParams, "message", { allowEmpty: true }) ?? "",
        embeds: actionParams.embeds,
        mediaUrl: readStringParam(actionParams, "media", { trim: false }),
        accountId,
      };
      break;
    case "poll":
      mapped = {
        action: "poll",
        to: readStringParam(actionParams, "to", { required: true }),
        question: readStringParam(actionParams, "pollQuestion", { required: true }),
        answers: readStringArrayParam(actionParams, "pollOption", { required: true }),
        allowMultiselect:
          actionParams.pollMulti === true || actionParams.pollMulti === "true" ? true : undefined,
        durationHours:
          typeof actionParams.pollDurationHours === "number"
            ? actionParams.pollDurationHours
            : undefined,
        accountId,
      };
      break;
    case "thread-reply":
      mapped = {
        action: "threadReply",
        channelId:
          readStringParam(actionParams, "threadId") ??
          readStringParam(actionParams, "channelId", { required: true }),
        content: readStringParam(actionParams, "message", { allowEmpty: true }) ?? "",
        accountId,
      };
      break;
    case "thread-create":
      mapped = {
        action: "threadCreate",
        channelId: readStringParam(actionParams, "to", { required: true }).replace(/^channel:/, ""),
        name: readStringParam(actionParams, "threadName", { required: true }),
        content: readStringParam(actionParams, "message", { allowEmpty: true }) ?? "",
        accountId,
      };
      break;
    case "channel-edit":
      mapped = {
        action: "channelEdit",
        channelId: readStringParam(actionParams, "channelId", { required: true }),
        archived: actionParams.archived,
        locked: actionParams.locked,
        autoArchiveDuration: actionParams.autoArchiveDuration,
        accountId,
      };
      break;
    case "timeout":
      mapped = {
        action: "timeout",
        guildId: readStringParam(actionParams, "guildId", { required: true }),
        userId: readStringParam(actionParams, "userId", { required: true }),
        durationMinutes: readNumberParam(actionParams, "durationMin", { integer: true }),
        senderUserId: params.requesterSenderId ?? readStringParam(actionParams, "senderUserId"),
        accountId,
      };
      break;
    case "react": {
      const messageId = resolveReactionMessageId({
        args: actionParams,
        toolContext: params.toolContext as { currentMessageId?: string | number } | undefined,
      });
      if (messageId == null) {
        throw new Error("messageId required");
      }
      mapped = {
        action: "react",
        channelId: readStringParam(actionParams, "channelId", { required: true }),
        messageId,
        emoji: readStringParam(actionParams, "emoji", { required: true }),
        accountId,
      };
      break;
    }
    default:
      mapped = { ...actionParams, action: params.action, accountId };
  }
  return await invoke(mapped, params.cfg, { mediaLocalRoots: params.mediaLocalRoots });
}
