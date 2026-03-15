import { normalizeE164 } from "../../../utils.js";
import type { ChannelOnboardingAdapter } from "../onboarding-types.js";
import * as onboardingHelpers from "./helpers.js";

const channel = "signal" as const;
const MIN_E164_DIGITS = 5;
const MAX_E164_DIGITS = 15;
const DIGITS_ONLY = /^\d+$/;

export function normalizeSignalAccountInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = normalizeE164(trimmed);
  const digits = normalized.slice(1);
  if (!DIGITS_ONLY.test(digits)) {
    return null;
  }
  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) {
    return null;
  }
  return `+${digits}`;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parseSignalAllowFromEntries(raw: string): { entries: string[]; error?: string } {
  return onboardingHelpers.parseOnboardingEntriesAllowingWildcard(raw, (entry) => {
    if (entry.toLowerCase().startsWith("uuid:")) {
      const id = entry.slice("uuid:".length).trim();
      if (!id) {
        return { error: "Invalid uuid entry" };
      }
      return { value: `uuid:${id}` };
    }
    if (isUuidLike(entry)) {
      return { value: `uuid:${entry}` };
    }
    const normalized = normalizeSignalAccountInput(entry);
    if (!normalized) {
      return { error: `Invalid entry: ${entry}` };
    }
    return { value: normalized };
  });
}

export const signalOnboardingAdapter: ChannelOnboardingAdapter = {
  channel,
  getStatus: async () => ({
    channel,
    configured: false,
    statusLines: ["Signal: unavailable in this trimmed build"],
    selectionHint: "disabled in trimmed build",
    quickstartScore: 0,
  }),
  configure: async ({ cfg, prompter }) => {
    await prompter.note("Signal onboarding is unavailable in this trimmed build.", "Signal");
    return { cfg };
  },
  disable: (cfg) => cfg,
};
