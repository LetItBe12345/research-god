export function resolveWhatsAppOutboundTarget(params: {
  to?: string;
  allowFrom?: readonly string[];
  mode?: "explicit" | "implicit" | "heartbeat";
}): { ok: true; to: string } | { ok: false; error: Error } {
  const normalized = params.to?.trim().replace(/^whatsapp:/i, "");
  if (!normalized) {
    return { ok: false, error: new Error("Missing WhatsApp target") };
  }
  const allowFrom = (params.allowFrom ?? []).map((entry) => entry.trim()).filter(Boolean);
  if (params.mode === "implicit" && allowFrom.length > 0 && !allowFrom.includes(normalized)) {
    return {
      ok: false,
      error: new Error(`WhatsApp target not allowed: ${normalized}`),
    };
  }
  return { ok: true, to: normalized };
}
