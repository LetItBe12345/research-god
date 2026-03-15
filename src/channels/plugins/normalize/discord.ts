function stripDiscordPrefix(value: string): string {
  return value
    .trim()
    .replace(/^discord:/i, "")
    .trim();
}

export function normalizeDiscordMessagingTarget(raw: string): string | undefined {
  const trimmed = stripDiscordPrefix(raw);
  if (!trimmed) {
    return undefined;
  }
  const userMention = trimmed.match(/^<@!?(\d+)>$/);
  if (userMention) {
    return `user:${userMention[1]}`;
  }
  const channelMention = trimmed.match(/^<#(\d+)>$/);
  if (channelMention) {
    return `channel:${channelMention[1]}`;
  }
  if (/^(user|channel):/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^\d+$/.test(trimmed)) {
    return `channel:${trimmed}`;
  }
  return undefined;
}

export function normalizeDiscordOutboundTarget(raw: string): string | undefined {
  return normalizeDiscordMessagingTarget(raw);
}

export function looksLikeDiscordTargetId(raw: string): boolean {
  return Boolean(normalizeDiscordMessagingTarget(raw));
}
