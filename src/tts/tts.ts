import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import { normalizeResolvedSecretInputString } from "../config/types.secrets.js";
import type { TtsAutoMode, TtsConfig, TtsProvider } from "../config/types.tts.js";

export const OPENAI_TTS_MODELS = ["gpt-4o-mini-tts"] as const;
export const OPENAI_TTS_VOICES = ["alloy"] as const;

const DEFAULT_TTS_PROVIDER: TtsProvider = "edge";
const DEFAULT_TTS_AUTO: TtsAutoMode = "off";
const DEFAULT_TTS_MAX_LENGTH = 1500;

type ResolvedTtsConfig = TtsConfig & {
  enabled?: boolean;
  mode?: "all" | "final";
  provider?: TtsProvider;
};

type TtsPrefs = {
  enabled?: boolean;
  provider?: TtsProvider;
  maxLength?: number;
  summarize?: boolean;
  auto?: TtsAutoMode;
};

type TtsStatusEntry = {
  timestamp: number;
  success: boolean;
  textLength: number;
  summarized: boolean;
  provider?: string;
  latencyMs?: number;
  error?: string;
};

let lastTtsAttempt: TtsStatusEntry | undefined;

function resolveStateDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readPrefs(prefsPath?: string): TtsPrefs {
  if (!prefsPath || !fs.existsSync(prefsPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(prefsPath, "utf8")) as TtsPrefs;
  } catch {
    return {};
  }
}

function writePrefs(prefsPath: string | undefined, prefs: TtsPrefs): void {
  if (!prefsPath) {
    return;
  }
  ensureParentDir(prefsPath);
  fs.writeFileSync(prefsPath, `${JSON.stringify(prefs, null, 2)}\n`, "utf8");
}

function updatePrefs(prefsPath: string | undefined, patch: Partial<TtsPrefs>): void {
  writePrefs(prefsPath, { ...readPrefs(prefsPath), ...patch });
}

export function resolveTtsConfig(cfg?: OpenClawConfig): ResolvedTtsConfig {
  const config = (cfg?.tts ?? {}) as TtsConfig;
  return {
    ...config,
    enabled: config.enabled,
    mode: config.mode === "all" ? "all" : "final",
    provider: config.provider ?? DEFAULT_TTS_PROVIDER,
  };
}

export function resolveTtsPrefsPath(config?: { prefsPath?: string }): string {
  const configured = typeof config?.prefsPath === "string" ? config.prefsPath.trim() : "";
  if (configured) {
    return configured;
  }
  return path.join(resolveStateDir(), "tts-prefs.json");
}

export function normalizeTtsAutoMode(value: unknown): TtsAutoMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "off" ||
    normalized === "always" ||
    normalized === "inbound" ||
    normalized === "tagged"
  ) {
    return normalized;
  }
  return undefined;
}

export function resolveTtsAutoMode(params: {
  config?: { auto?: TtsAutoMode; enabled?: boolean };
  prefsPath?: string;
}): TtsAutoMode {
  const prefs = readPrefs(params.prefsPath);
  return (
    prefs.auto ?? params.config?.auto ?? (params.config?.enabled ? "always" : DEFAULT_TTS_AUTO)
  );
}

export function buildTtsSystemPromptHint(_cfg?: OpenClawConfig): string {
  return "";
}

export function resolveTtsApiKey(
  config: ResolvedTtsConfig | undefined,
  provider: Exclude<TtsProvider, "edge">,
): string | undefined {
  if (provider === "openai") {
    return normalizeResolvedSecretInputString(config?.openai?.apiKey);
  }
  return normalizeResolvedSecretInputString(config?.elevenlabs?.apiKey);
}

export function isTtsProviderConfigured(
  config: ResolvedTtsConfig | undefined,
  provider: TtsProvider,
): boolean {
  if (provider === "edge") {
    return config?.edge?.enabled !== false;
  }
  return Boolean(resolveTtsApiKey(config, provider));
}

export function getTtsProvider(
  config?: { provider?: TtsProvider },
  prefsPath?: string,
): TtsProvider {
  return readPrefs(prefsPath).provider ?? config?.provider ?? DEFAULT_TTS_PROVIDER;
}

export function resolveTtsProviderOrder(primary: TtsProvider): TtsProvider[] {
  return Array.from(new Set([primary, "edge", "openai", "elevenlabs"]));
}

export function getTtsMaxLength(prefsPath?: string): number {
  const maxLength = readPrefs(prefsPath).maxLength;
  return typeof maxLength === "number" && Number.isFinite(maxLength)
    ? maxLength
    : DEFAULT_TTS_MAX_LENGTH;
}

export function isSummarizationEnabled(prefsPath?: string): boolean {
  return readPrefs(prefsPath).summarize ?? true;
}

export function isTtsEnabled(config?: { enabled?: boolean }, prefsPath?: string): boolean {
  return readPrefs(prefsPath).enabled ?? config?.enabled ?? false;
}

export function setTtsEnabled(prefsPath: string | undefined, enabled: boolean): void {
  updatePrefs(prefsPath, { enabled });
}

export function setTtsProvider(prefsPath: string | undefined, provider: TtsProvider): void {
  updatePrefs(prefsPath, { provider });
}

export function setTtsMaxLength(prefsPath: string | undefined, maxLength: number): void {
  updatePrefs(prefsPath, { maxLength });
}

export function setSummarizationEnabled(prefsPath: string | undefined, summarize: boolean): void {
  updatePrefs(prefsPath, { summarize });
}

export function getLastTtsAttempt(): TtsStatusEntry | undefined {
  return lastTtsAttempt;
}

export function setLastTtsAttempt(entry: TtsStatusEntry): void {
  lastTtsAttempt = entry;
}

export async function maybeApplyTtsToPayload<T extends { text?: string }>(params: {
  payload: T;
}): Promise<T | null> {
  return params.payload;
}

export async function textToSpeech(params: {
  text: string;
  cfg?: OpenClawConfig;
  channel?: string;
  prefsPath?: string;
}): Promise<{
  success: boolean;
  audioPath?: string;
  error?: string;
  latencyMs?: number;
  provider?: string;
  outputFormat?: string;
  voiceCompatible?: boolean;
}> {
  const startedAt = Date.now();
  const config = resolveTtsConfig(params.cfg);
  const prefsPath = params.prefsPath ?? resolveTtsPrefsPath(config);
  const provider = getTtsProvider(config, prefsPath);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-tts-"));
  const extension = params.channel === "telegram" ? ".opus" : ".mp3";
  const audioPath = path.join(tmpDir, `voice-${randomUUID()}${extension}`);
  fs.writeFileSync(audioPath, Buffer.alloc(0));
  return {
    success: true,
    audioPath,
    latencyMs: Date.now() - startedAt,
    provider,
    outputFormat: extension.slice(1),
    voiceCompatible: params.channel === "telegram",
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
