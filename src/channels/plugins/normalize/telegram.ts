function stripTelegramPrefix(value: string): string {
  return value.trim().replace(/^(telegram|tg):/i, "").trim();
}

export function normalizeTelegramMessagingTarget(raw: string): string | undefined {
  const trimmed = stripTelegramPrefix(raw);
  if (!trimmed) {
    return undefined;
  }
  if (/^-?\d+(?::topic:\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("@")) {
    return trimmed.toLowerCase();
  }
  if (/^[A-Za-z0-9_]+$/.test(trimmed)) {
    return `@${trimmed.toLowerCase()}`;
  }
  return undefined;
}

export function looksLikeTelegramTargetId(raw: string): boolean {
  return Boolean(normalizeTelegramMessagingTarget(raw));
}
