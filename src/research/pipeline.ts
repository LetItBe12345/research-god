import { runResearchApiRequest, type ResearchApiResponse } from "../commands/research.openai.js";
import type { RuntimeEnv } from "../runtime.js";
import { shouldUseExplicitStageContext } from "./config.js";
import { shouldRetryWithoutPreviousResponse } from "./parsing.js";
import type { ResearchRunOptions, ResearchStageName } from "./types.js";

export async function runStage(
  runtime: RuntimeEnv,
  name: ResearchStageName,
  opts: ResearchRunOptions,
  input: Omit<
    Parameters<typeof runResearchApiRequest>[0],
    "env" | "apiKey" | "baseUrl" | "fetchImpl"
  >,
): Promise<ResearchApiResponse> {
  runtime.log(`Running research stage: ${name}`);
  return await runResearchApiRequest({
    ...input,
    env: opts.env ?? process.env,
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    fetchImpl: opts.fetchImpl,
    requestTimeoutMs: opts.requestTimeoutMs,
    responseMode: opts.responseMode,
    pollIntervalMs: opts.pollIntervalMs,
  });
}

export async function runStageWithContextFallback(
  runtime: RuntimeEnv,
  name: Exclude<ResearchStageName, "idea">,
  opts: ResearchRunOptions,
  params: {
    model: string;
    thinking: string;
    instructions: string;
    primaryInput: string;
    fallbackInput: string;
    previousResponseId: string;
    maxOutputTokens?: number;
    allowedTools?: Parameters<typeof runResearchApiRequest>[0]["allowedTools"];
  },
): Promise<{
  response: ResearchApiResponse;
  prompt: string;
  contextMode: "previous_response_id" | "explicit_context";
}> {
  if (shouldUseExplicitStageContext(opts)) {
    const response = await runStage(runtime, name, opts, {
      model: params.model,
      thinking: params.thinking,
      instructions: params.instructions,
      input: params.fallbackInput,
      maxOutputTokens: params.maxOutputTokens,
      allowedTools: params.allowedTools,
    });
    return {
      response,
      prompt: params.fallbackInput,
      contextMode: "explicit_context",
    };
  }

  try {
    const response = await runStage(runtime, name, opts, {
      model: params.model,
      thinking: params.thinking,
      previousResponseId: params.previousResponseId,
      instructions: params.instructions,
      input: params.primaryInput,
      maxOutputTokens: params.maxOutputTokens,
      allowedTools: params.allowedTools,
    });
    return {
      response,
      prompt: params.primaryInput,
      contextMode: "previous_response_id",
    };
  } catch (error) {
    if (!shouldRetryWithoutPreviousResponse(error)) {
      throw error;
    }
    runtime.log(
      `Research stage ${name} failed to use previous_response_id; retrying with explicit context.`,
    );
    const response = await runStage(runtime, name, opts, {
      model: params.model,
      thinking: params.thinking,
      instructions: params.instructions,
      input: params.fallbackInput,
      maxOutputTokens: params.maxOutputTokens,
      allowedTools: params.allowedTools,
    });
    return {
      response,
      prompt: params.fallbackInput,
      contextMode: "explicit_context",
    };
  }
}
