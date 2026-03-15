import type { OpenClawConfig } from "../config/config.js";
import type { TtsAutoMode, TtsConfig, TtsProvider } from "../config/types.tts.js";
export declare const OPENAI_TTS_MODELS: readonly ["gpt-4o-mini-tts"];
export declare const OPENAI_TTS_VOICES: readonly ["alloy"];
type ResolvedTtsConfig = TtsConfig & {
    enabled?: boolean;
    mode?: "all" | "final";
    provider?: TtsProvider;
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
export declare function resolveTtsConfig(cfg?: OpenClawConfig): ResolvedTtsConfig;
export declare function resolveTtsPrefsPath(config?: {
    prefsPath?: string;
}): string;
export declare function normalizeTtsAutoMode(value: unknown): TtsAutoMode | undefined;
export declare function resolveTtsAutoMode(params: {
    config?: {
        auto?: TtsAutoMode;
        enabled?: boolean;
    };
    prefsPath?: string;
}): TtsAutoMode;
export declare function buildTtsSystemPromptHint(_cfg?: OpenClawConfig): string;
export declare function resolveTtsApiKey(config: ResolvedTtsConfig | undefined, provider: Exclude<TtsProvider, "edge">): string | undefined;
export declare function isTtsProviderConfigured(config: ResolvedTtsConfig | undefined, provider: TtsProvider): boolean;
export declare function getTtsProvider(config?: {
    provider?: TtsProvider;
}, prefsPath?: string): TtsProvider;
export declare function resolveTtsProviderOrder(primary: TtsProvider): TtsProvider[];
export declare function getTtsMaxLength(prefsPath?: string): number;
export declare function isSummarizationEnabled(prefsPath?: string): boolean;
export declare function isTtsEnabled(config?: {
    enabled?: boolean;
}, prefsPath?: string): boolean;
export declare function setTtsEnabled(prefsPath: string | undefined, enabled: boolean): void;
export declare function setTtsProvider(prefsPath: string | undefined, provider: TtsProvider): void;
export declare function setTtsMaxLength(prefsPath: string | undefined, maxLength: number): void;
export declare function setSummarizationEnabled(prefsPath: string | undefined, summarize: boolean): void;
export declare function getLastTtsAttempt(): TtsStatusEntry | undefined;
export declare function setLastTtsAttempt(entry: TtsStatusEntry): void;
export declare function maybeApplyTtsToPayload<T extends {
    text?: string;
}>(params: {
    payload: T;
}): Promise<T | null>;
export declare function textToSpeech(params: {
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
}>;
export declare function textToSpeechTelephony(_params: {
    text: string;
    cfg?: OpenClawConfig;
}): Promise<{
    contentType: string;
    buffer: Buffer;
}>;
export {};
