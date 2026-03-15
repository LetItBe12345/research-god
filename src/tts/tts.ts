import type { OpenClawConfig } from "../config/config.js";

export function resolveTtsConfig(_cfg?: OpenClawConfig): {
  enabled?: boolean;
  mode?: "block" | "final";
} {
  return {};
}

export function normalizeTtsAutoMode(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function buildTtsSystemPromptHint(_cfg?: OpenClawConfig): string {
  return "";
}

export async function maybeApplyTtsToPayload<T extends { text?: string }>(params: {
  payload: T;
}): Promise<T | null> {
  return params.payload;
}

export async function textToSpeech(_params: {
  text: string;
  cfg?: OpenClawConfig;
  channel?: string;
}): Promise<{ contentType: string; buffer: Buffer; provider?: string; voice?: string }> {
  return {
    contentType: "audio/mpeg",
    buffer: Buffer.alloc(0),
  };
}

export async function textToSpeechTelephony(_params: {
  text: string;
  cfg?: OpenClawConfig;
}): Promise<{ contentType: string; buffer: Buffer }> {
  return {
    contentType: "audio/mpeg",
    buffer: Buffer.alloc(0),
  };
}
