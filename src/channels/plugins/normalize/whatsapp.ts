import { isWhatsAppGroupJid, normalizeWhatsAppTarget } from "../../../whatsapp/normalize.js";

export { isWhatsAppGroupJid, normalizeWhatsAppTarget };

export function normalizeWhatsAppMessagingTarget(value: string): string | undefined {
  return normalizeWhatsAppTarget(value) ?? undefined;
}

export function looksLikeWhatsAppTargetId(value: string): boolean {
  return Boolean(normalizeWhatsAppMessagingTarget(value));
}

export function normalizeWhatsAppAllowFromEntries(
  allowFrom: Array<string | number>,
): string[] {
  return allowFrom
    .map((entry) => String(entry).trim())
    .map((entry) => normalizeWhatsAppTarget(entry) ?? entry)
    .filter(Boolean);
}
