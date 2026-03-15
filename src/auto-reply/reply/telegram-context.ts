function parseTelegramTarget(target: string): { chatId: string } {
  const trimmed = target.trim();
  if (!trimmed) {
    return { chatId: "" };
  }
  const normalized = trimmed.replace(/^telegram:/i, "");
  const parts = normalized
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);
  const topicIndex = parts.findIndex((part) => part.toLowerCase() === "topic");
  if (topicIndex > 0) {
    return { chatId: parts[topicIndex - 1] ?? "" };
  }
  return { chatId: parts.at(-1) ?? normalized };
}

type TelegramConversationParams = {
  ctx: {
    MessageThreadId?: string | number | null;
    OriginatingTo?: string;
    To?: string;
  };
  command: {
    to?: string;
  };
};

export function resolveTelegramConversationId(
  params: TelegramConversationParams,
): string | undefined {
  const rawThreadId =
    params.ctx.MessageThreadId != null ? String(params.ctx.MessageThreadId).trim() : "";
  const threadId = rawThreadId || undefined;
  const toCandidates = [
    typeof params.ctx.OriginatingTo === "string" ? params.ctx.OriginatingTo : "",
    typeof params.command.to === "string" ? params.command.to : "",
    typeof params.ctx.To === "string" ? params.ctx.To : "",
  ]
    .map((value) => value.trim())
    .filter(Boolean);
  const chatId = toCandidates
    .map((candidate) => parseTelegramTarget(candidate).chatId.trim())
    .find((candidate) => candidate.length > 0);
  if (!chatId) {
    return undefined;
  }
  if (threadId) {
    return `${chatId}:topic:${threadId}`;
  }
  // Non-topic groups should not become globally focused conversations.
  if (chatId.startsWith("-")) {
    return undefined;
  }
  return chatId;
}
