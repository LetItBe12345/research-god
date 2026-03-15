export function normalizeWhatsAppTarget(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.replace(/^whatsapp:/i, "");
}

export function isWhatsAppGroupJid(value?: string | null): boolean {
  const normalized = normalizeWhatsAppTarget(value);
  return Boolean(normalized && normalized.endsWith("@g.us"));
}
