import type { ChannelOnboardingAdapter } from "../onboarding-types.js";
import { parseOnboardingEntriesAllowingWildcard } from "./helpers.js";

const channel = "imessage" as const;

function normalizeIMessageHandle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  if (/^\+?[0-9 ()-]+$/.test(trimmed)) {
    const digits = trimmed.replace(/[^\d+]/g, "");
    return digits.startsWith("+") ? digits : `+${digits}`;
  }
  return null;
}

export function parseIMessageAllowFromEntries(raw: string): { entries: string[]; error?: string } {
  return parseOnboardingEntriesAllowingWildcard(raw, (entry) => {
    const lower = entry.toLowerCase();
    if (lower.startsWith("chat_id:")) {
      const id = entry.slice("chat_id:".length).trim();
      if (!/^\d+$/.test(id)) {
        return { error: `Invalid chat_id: ${entry}` };
      }
      return { value: entry };
    }
    if (lower.startsWith("chat_guid:")) {
      if (!entry.slice("chat_guid:".length).trim()) {
        return { error: "Invalid chat_guid entry" };
      }
      return { value: entry };
    }
    if (lower.startsWith("chat_identifier:")) {
      if (!entry.slice("chat_identifier:".length).trim()) {
        return { error: "Invalid chat_identifier entry" };
      }
      return { value: entry };
    }
    if (!normalizeIMessageHandle(entry)) {
      return { error: `Invalid handle: ${entry}` };
    }
    return { value: entry };
  });
}

export const imessageOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async () => ({
    channel,
    configured: false,
    statusLines: ["iMessage: unavailable in this trimmed build"],
    selectionHint: "disabled in trimmed build",
    quickstartScore: 0,
  }),
  configure: async ({ cfg, prompter }) => {
    await prompter.note("iMessage onboarding is unavailable in this trimmed build.", "iMessage");
    return { cfg };
  },
  disable: (cfg) => cfg,
};
