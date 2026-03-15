export function normalizeSlackMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^<@([A-Z0-9]+)>$/i.test(trimmed)) {
    return `user:${trimmed.slice(2, -1)}`.toLowerCase();
  }
  if (/^#[^#\s]+$/.test(trimmed)) {
    return `channel:${trimmed.slice(1)}`.toLowerCase();
  }
  if (/^(user|channel):/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const noPrefix = trimmed.replace(/^slack:/i, "").trim();
  if (!noPrefix) {
    return undefined;
  }
  return /^[UW][A-Z0-9]{8,}$/i.test(noPrefix)
    ? `user:${noPrefix}`.toLowerCase()
    : `channel:${noPrefix}`.toLowerCase();
}

export function looksLikeSlackTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  if (/^<@([A-Z0-9]+)>$/i.test(trimmed)) {
    return true;
  }
  if (/^(user|channel):/i.test(trimmed)) {
    return true;
  }
  if (/^slack:/i.test(trimmed)) {
    return true;
  }
  if (/^[@#]/.test(trimmed)) {
    return true;
  }
  return /^[CUWGD][A-Z0-9]{8,}$/i.test(trimmed);
}
