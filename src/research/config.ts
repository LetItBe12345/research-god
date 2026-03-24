import fs from "node:fs/promises";
import path from "node:path";
import { normalizeWhitespace } from "./shared.js";
import {
  RESEARCH_MODELS,
  RESEARCH_THINKING_LEVELS,
  type ResearchModel,
  type ResearchRunOptions,
  type ResearchThinkingLevel,
} from "./types.js";

export async function readIdeaInput(opts: ResearchRunOptions): Promise<string> {
  const inlineIdea = typeof opts.idea === "string" ? normalizeWhitespace(opts.idea) : "";
  if (inlineIdea.length > 0) {
    return inlineIdea;
  }
  if (typeof opts.ideaFile === "string" && opts.ideaFile.trim().length > 0) {
    const content = await fs.readFile(opts.ideaFile, "utf-8");
    const fileIdea = normalizeWhitespace(content);
    if (fileIdea.length > 0) {
      return fileIdea;
    }
  }
  throw new Error("Provide --idea or --idea-file with non-empty content");
}

export function resolveCount(input: number | undefined): number {
  if (input === undefined) {
    return 3;
  }
  if (!Number.isInteger(input) || input < 1 || input > 10) {
    throw new Error("Invalid --count. Use an integer between 1 and 10.");
  }
  return input;
}

export function resolveModel(input: string | undefined): ResearchModel {
  const model = input?.trim() || RESEARCH_MODELS[0];
  if ((RESEARCH_MODELS as readonly string[]).includes(model)) {
    return model as ResearchModel;
  }
  throw new Error(`Invalid --model. Use one of: ${RESEARCH_MODELS.join(", ")}`);
}

export function resolveThinking(input: string | undefined): ResearchThinkingLevel {
  const thinkingRaw = input?.trim() || "xhigh";
  const thinking =
    thinkingRaw === "off"
      ? "none"
      : thinkingRaw === "minimal"
        ? "low"
        : thinkingRaw === "adaptive"
          ? "high"
          : thinkingRaw;
  if ((RESEARCH_THINKING_LEVELS as readonly string[]).includes(thinking)) {
    return thinking as ResearchThinkingLevel;
  }
  throw new Error(`Invalid --thinking. Use one of: ${RESEARCH_THINKING_LEVELS.join(", ")}`);
}

export function defaultOutputRoot(cwd: string): string {
  return path.join(cwd, "research");
}

export function defaultTickWorkspace(cwd: string): string {
  return cwd;
}

export function resolveApiBaseUrlForResearch(opts: ResearchRunOptions): string {
  const baseUrl = opts.baseUrl ?? opts.env?.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  return baseUrl.replace(/\/+$/, "");
}

export function shouldUseExplicitStageContext(opts: ResearchRunOptions): boolean {
  const mode = opts.env?.OPENAI_RESEARCH_CONTEXT_MODE?.trim().toLowerCase();
  if (mode === "explicit") {
    return true;
  }
  if (mode === "response_id") {
    return false;
  }
  try {
    return new URL(resolveApiBaseUrlForResearch(opts)).hostname !== "api.openai.com";
  } catch {
    return false;
  }
}
