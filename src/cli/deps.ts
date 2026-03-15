import type { OutboundSendDeps } from "../infra/outbound/send-deps.js";
import { createOutboundSendDepsFromCliSource } from "./outbound-send-mapping.js";

/**
 * Lazy-loaded per-channel send functions, keyed by channel ID.
 * Values are proxy functions that dynamically import the real module on first use.
 */
export type CliDeps = { [channelId: string]: unknown };

function createUnsupportedSender(channelId: string): (...args: unknown[]) => Promise<never> {
  return async () => {
    throw new Error(`${channelId} send is unavailable in this trimmed build.`);
  };
}

export function createDefaultDeps(): CliDeps {
  return {
    whatsapp: createUnsupportedSender("whatsapp"),
    telegram: createUnsupportedSender("telegram"),
    discord: createUnsupportedSender("discord"),
    slack: createUnsupportedSender("slack"),
    signal: createUnsupportedSender("signal"),
    imessage: createUnsupportedSender("imessage"),
  };
}

export function createOutboundSendDeps(deps: CliDeps): OutboundSendDeps {
  return createOutboundSendDepsFromCliSource(deps);
}

export async function logWebSelfId(): Promise<void> {}
