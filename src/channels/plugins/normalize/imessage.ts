import { looksLikeHandleOrPhoneTarget, trimMessagingTarget } from "./shared.js";

// Service prefixes that indicate explicit delivery method; must be preserved during normalization
const SERVICE_PREFIXES = ["imessage:", "sms:", "auto:"] as const;
const CHAT_TARGET_PREFIX_RE =
  /^(chat_id:|chatid:|chat:|chat_guid:|chatguid:|guid:|chat_identifier:|chatidentifier:|chatident:)/i;

export function normalizeIMessageMessagingTarget(raw: string): string | undefined {
  const trimmed = trimMessagingTarget(raw);
  if (!trimmed) {
    return undefined;
  }

  // Preserve service prefix if present (e.g., "sms:+1555" → "sms:+15551234567")
  const lower = trimmed.toLowerCase();
  for (const prefix of SERVICE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const remainder = trimmed.slice(prefix.length).trim();
      const normalizedHandle = normalizeIMessageHandle(remainder);
      if (!normalizedHandle) {
        return undefined;
      }
      if (CHAT_TARGET_PREFIX_RE.test(normalizedHandle)) {
        return normalizedHandle;
      }
      return `${prefix}${normalizedHandle}`;
    }
  }

  const normalized = normalizeIMessageHandle(trimmed);
  return normalized || undefined;
}

export function looksLikeIMessageTargetId(raw: string): boolean {
  const trimmed = trimMessagingTarget(raw);
  if (!trimmed) {
    return false;
  }
  if (CHAT_TARGET_PREFIX_RE.test(trimmed)) {
    return true;
  }
  return looksLikeHandleOrPhoneTarget({
    raw: trimmed,
    prefixPattern: /^(imessage:|sms:|auto:)/i,
  });
}

function normalizeIMessageHandle(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (CHAT_TARGET_PREFIX_RE.test(trimmed)) {
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      return trimmed.toLowerCase();
    }
    const rawPrefix = trimmed.slice(0, separatorIndex).toLowerCase();
    const rest = trimmed.slice(separatorIndex + 1);
    const prefix =
      rawPrefix === "chatid" || rawPrefix === "chat"
        ? "chat_id"
        : rawPrefix === "chatguid" || rawPrefix === "guid"
          ? "chat_guid"
          : rawPrefix === "chatidentifier" || rawPrefix === "chatident"
            ? "chat_identifier"
            : rawPrefix;
    return `${prefix}:${rest}`;
  }
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits || trimmed;
}
