import { z } from "zod";

export const RESEARCH_API_MODELS = ["openai/gpt-5.4", "openai/gpt-5.4-pro"] as const;
export const RESEARCH_THINKING_LEVELS = ["none", "low", "medium", "high", "xhigh"] as const;
export const RESEARCH_RESPONSE_MODES = ["sync", "poll"] as const;

export const GPT_5_4_MODEL_TOOLS = [
  "web_search",
  "file_search",
  "image_generation",
  "code_interpreter",
  "shell",
  "apply_patch",
  "skills",
  "computer",
  "mcp",
  "tool_search",
] as const;

export const GPT_5_4_PRO_MODEL_TOOLS = [
  "web_search",
  "file_search",
  "image_generation",
  "apply_patch",
  "computer",
  "mcp",
  "tool_search",
] as const;

export type ResearchApiModel = (typeof RESEARCH_API_MODELS)[number];
export type ResearchThinkingLevel = (typeof RESEARCH_THINKING_LEVELS)[number];
export type ResearchResponseMode = (typeof RESEARCH_RESPONSE_MODES)[number];
export type ResearchAvailableTool =
  | (typeof GPT_5_4_MODEL_TOOLS)[number]
  | (typeof GPT_5_4_PRO_MODEL_TOOLS)[number];

export type ResearchApiRequestOptions = {
  model: string;
  thinking: string;
  instructions: string;
  input: string;
  previousResponseId?: string;
  maxOutputTokens?: number;
  allowedTools?: ResearchAvailableTool[];
  requestTimeoutMs?: number;
  responseMode?: string;
  pollIntervalMs?: number;
  env?: NodeJS.ProcessEnv;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type ResearchApiResponse = {
  id: string;
  text: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  attachedTools: ResearchAvailableTool[];
  skippedTools: Array<{ tool: ResearchAvailableTool; reason: string }>;
};

export class ResearchApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly param?: string;

  constructor(
    message: string,
    params: {
      status: number;
      code?: string;
      param?: string;
    },
  ) {
    super(message);
    this.name = "ResearchApiError";
    this.status = params.status;
    this.code = params.code;
    this.param = params.param;
  }
}

export const DEFAULT_RESEARCH_REQUEST_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_RESEARCH_POLL_INTERVAL_MS = 5_000;

const ResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  status: z.string(),
  output_text: z.string().optional(),
  output: z
    .array(
      z.union([
        z.object({
          type: z.literal("message"),
          content: z.array(
            z.object({
              type: z.string(),
              text: z.string().optional(),
            }),
          ),
        }),
        z.object({
          type: z.literal("output_text"),
          text: z.string(),
        }),
        z.object({
          type: z.string(),
        }),
      ]),
    )
    .optional(),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
      total_tokens: z.number().int().nonnegative(),
    })
    .optional(),
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

function normalizeModel(model: string): string {
  const normalized = model.trim();
  if ((RESEARCH_API_MODELS as readonly string[]).includes(normalized)) {
    return normalized.replace(/^openai\//, "");
  }
  throw new Error(`Invalid --model. Use one of: ${RESEARCH_API_MODELS.join(", ")}`);
}

function resolveApiBaseUrl(opts: Pick<ResearchApiRequestOptions, "baseUrl" | "env">): string {
  const baseUrl = opts.baseUrl ?? opts.env?.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  return baseUrl.replace(/\/+$/, "");
}

function isOfficialOpenAiBaseUrl(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === "api.openai.com";
  } catch {
    return false;
  }
}

function supportsRelayByDefault(baseUrl: string, tool: ResearchAvailableTool): boolean {
  if (isOfficialOpenAiBaseUrl(baseUrl)) {
    return true;
  }
  return (
    tool === "web_search" ||
    tool === "image_generation" ||
    tool === "code_interpreter" ||
    tool === "shell" ||
    tool === "apply_patch"
  );
}

function resolveApiKey(opts: Pick<ResearchApiRequestOptions, "apiKey" | "env">): string {
  const apiKey = opts.apiKey ?? opts.env?.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("Missing OpenAI API key. Set OPENAI_API_KEY.");
  }
  return apiKey.trim();
}

function resolveRequestTimeoutMs(
  opts: Pick<ResearchApiRequestOptions, "requestTimeoutMs" | "env">,
): number {
  const envValue = opts.env?.OPENAI_RESEARCH_REQUEST_TIMEOUT_MS?.trim();
  const candidate =
    opts.requestTimeoutMs ?? (envValue ? Number.parseInt(envValue, 10) : undefined);
  const timeoutMs = candidate ?? DEFAULT_RESEARCH_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      "Invalid research request timeout. Use a positive integer number of milliseconds.",
    );
  }
  return Math.floor(timeoutMs);
}

function resolveResponseMode(
  opts: Pick<ResearchApiRequestOptions, "responseMode" | "env">,
): ResearchResponseMode {
  const raw = (opts.responseMode ?? opts.env?.OPENAI_RESEARCH_RESPONSE_MODE ?? "sync")
    .trim()
    .toLowerCase();
  if ((RESEARCH_RESPONSE_MODES as readonly string[]).includes(raw)) {
    return raw as ResearchResponseMode;
  }
  throw new Error(
    `Invalid research response mode. Use one of: ${RESEARCH_RESPONSE_MODES.join(", ")}.`,
  );
}

function resolvePollIntervalMs(
  opts: Pick<ResearchApiRequestOptions, "pollIntervalMs" | "env">,
): number {
  const envValue = opts.env?.OPENAI_RESEARCH_POLL_INTERVAL_MS?.trim();
  const candidate = opts.pollIntervalMs ?? (envValue ? Number.parseInt(envValue, 10) : undefined);
  const pollIntervalMs = candidate ?? DEFAULT_RESEARCH_POLL_INTERVAL_MS;
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new Error(
      "Invalid research poll interval. Use a non-negative integer number of milliseconds.",
    );
  }
  return Math.floor(pollIntervalMs);
}

function resolveReasoningEffort(
  model: string,
  thinking: string,
): "none" | "low" | "medium" | "high" | "xhigh" {
  const raw = thinking.trim() || "xhigh";
  const effort =
    raw === "off"
      ? "none"
      : raw === "minimal"
        ? "low"
        : raw === "adaptive"
          ? "high"
          : (raw as ResearchThinkingLevel);
  if (model === "gpt-5.4-pro" && (effort === "none" || effort === "low")) {
    return "medium";
  }
  return effort;
}

function resolveSupportedTools(model: string): readonly ResearchAvailableTool[] {
  return model === "gpt-5.4-pro" ? GPT_5_4_PRO_MODEL_TOOLS : GPT_5_4_MODEL_TOOLS;
}

function parseCsvEnv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveShellEnvironment(params: {
  env?: NodeJS.ProcessEnv;
  enableHostedContainer: boolean;
}): {
  environment?: Record<string, unknown>;
  skillsAttached: boolean;
} {
  if (!params.enableHostedContainer) {
    return {
      environment: undefined,
      skillsAttached: false,
    };
  }
  const skills = parseCsvEnv(params.env?.OPENAI_RESEARCH_SKILLS);
  return {
    environment:
      skills.length > 0
        ? {
            type: "container_auto",
            skills,
          }
        : undefined,
    skillsAttached: skills.length > 0,
  };
}

function buildToolConfig(params: {
  tool: ResearchAvailableTool;
  env?: NodeJS.ProcessEnv;
  baseUrl: string;
}): {
  config?: Record<string, unknown>;
  reason?: string;
} {
  switch (params.tool) {
    case "web_search":
      return { config: { type: "web_search" } };
    case "image_generation":
      return { config: { type: "image_generation" } };
    case "tool_search":
      return { config: { type: "tool_search" } };
    case "apply_patch":
      return { config: { type: "apply_patch" } };
    case "code_interpreter":
      return { config: { type: "code_interpreter", container: { type: "auto" } } };
    case "shell": {
      const shell = resolveShellEnvironment({
        env: params.env,
        enableHostedContainer: isOfficialOpenAiBaseUrl(params.baseUrl),
      });
      return {
        config: {
          type: "shell",
          ...(shell.environment ? { environment: shell.environment } : {}),
        },
      };
    }
    case "skills": {
      if (!isOfficialOpenAiBaseUrl(params.baseUrl)) {
        return {
          reason:
            "Skipped on non-OpenAI base URL because shell.environment.skills has not been verified to work reliably on compatible proxies.",
        };
      }
      const shell = resolveShellEnvironment({
        env: params.env,
        enableHostedContainer: true,
      });
      if (!shell.skillsAttached) {
        return {
          reason:
            "Set OPENAI_RESEARCH_SKILLS to attach GPT-5.4 skills through shell.environment.skills.",
        };
      }
      return {
        config: {
          type: "shell",
          environment: shell.environment,
        },
      };
    }
    case "file_search": {
      const vectorStoreIds = parseCsvEnv(params.env?.OPENAI_RESEARCH_VECTOR_STORE_IDS);
      if (vectorStoreIds.length === 0) {
        return { reason: "Set OPENAI_RESEARCH_VECTOR_STORE_IDS to enable file_search." };
      }
      return {
        config: {
          type: "file_search",
          vector_store_ids: vectorStoreIds,
        },
      };
    }
    case "mcp": {
      const serverUrl = params.env?.OPENAI_RESEARCH_MCP_SERVER_URL?.trim();
      if (!serverUrl) {
        return { reason: "Set OPENAI_RESEARCH_MCP_SERVER_URL to enable MCP." };
      }
      const serverLabel = params.env?.OPENAI_RESEARCH_MCP_SERVER_LABEL?.trim() || "research-mcp";
      return {
        config: {
          type: "mcp",
          server_label: serverLabel,
          server_url: serverUrl,
          require_approval: "never",
        },
      };
    }
    case "computer": {
      const environment = params.env?.OPENAI_RESEARCH_COMPUTER_ENVIRONMENT?.trim();
      if (!environment) {
        return {
          reason: "Set OPENAI_RESEARCH_COMPUTER_ENVIRONMENT to enable computer use.",
        };
      }
      return {
        config: {
          type: "computer",
          environment,
        },
      };
    }
  }
}

function resolveTools(
  model: string,
  baseUrl: string,
  env?: NodeJS.ProcessEnv,
  allowedTools?: readonly ResearchAvailableTool[],
): {
  attachedTools: ResearchAvailableTool[];
  skippedTools: Array<{ tool: ResearchAvailableTool; reason: string }>;
  tools: Record<string, unknown>[];
} {
  const attachedTools: ResearchAvailableTool[] = [];
  const skippedTools: Array<{ tool: ResearchAvailableTool; reason: string }> = [];
  const tools: Record<string, unknown>[] = [];
  let shellConfigured = false;
  const supportedTools = resolveSupportedTools(model);
  const requestedTools =
    allowedTools === undefined
      ? supportedTools
      : supportedTools.filter((tool) => allowedTools.includes(tool));
  for (const tool of requestedTools) {
    if (!supportsRelayByDefault(baseUrl, tool)) {
      skippedTools.push({
        tool,
        reason: isOfficialOpenAiBaseUrl(baseUrl)
          ? "Unsupported tool configuration."
          : tool === "tool_search"
            ? "Skipped on non-OpenAI base URL because many compatible proxies reject tool_search."
            : `Skipped on non-OpenAI base URL because ${tool} has not been verified to work reliably on compatible proxies.`,
      });
      continue;
    }
    if ((tool === "shell" || tool === "skills") && shellConfigured) {
      if (tool === "skills") {
        attachedTools.push(tool);
      }
      continue;
    }
    const resolved = buildToolConfig({ tool, env, baseUrl });
    if (resolved.config) {
      attachedTools.push(tool);
      tools.push(resolved.config);
      if (tool === "shell" || tool === "skills") {
        shellConfigured = true;
      }
      continue;
    }
    skippedTools.push({
      tool,
      reason: resolved.reason ?? "Unsupported tool configuration.",
    });
  }
  return { attachedTools, skippedTools, tools };
}

function extractResponseText(payload: z.infer<typeof ResponseSchema>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const chunks: string[] = [];
  for (const output of payload.output ?? []) {
    if (output.type === "output_text" && "text" in output && output.text.trim()) {
      chunks.push(output.text.trim());
      continue;
    }
    if (output.type !== "message" || !("content" in output)) {
      continue;
    }
    for (const part of output.content) {
      if (typeof part.text === "string" && part.text.trim()) {
        chunks.push(part.text.trim());
      }
    }
  }
  return chunks.join("\n\n").trim();
}

async function parseErrorResponse(response: Response): Promise<{
  message: string;
  code?: string;
  param?: string;
}> {
  const text = await response.text();
  if (!text) {
    return { message: `${response.status} ${response.statusText}` };
  }
  try {
    const parsed = z
      .object({
        error: z.object({
          message: z.string().optional(),
          code: z.string().optional(),
          param: z.string().optional(),
        }),
      })
      .parse(JSON.parse(text));
    const message = parsed.error.message?.trim();
    return {
      message: message ? `${response.status} ${message}` : `${response.status} ${text}`,
      code: parsed.error.code,
      param: parsed.error.param,
    };
  } catch {
    return { message: `${response.status} ${text}` };
  }
}

async function fetchWithTimeout(params: {
  fetchImpl: typeof fetch;
  url: string;
  init: RequestInit;
  timeoutMs: number;
  timeoutMessage: string;
}): Promise<Response> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, params.timeoutMs);
  try {
    return await params.fetchImpl(params.url, {
      ...params.init,
      signal: abortController.signal,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(params.timeoutMessage, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function toResearchApiResponse(params: {
  payload: z.infer<typeof ResponseSchema>;
  attachedTools: ResearchAvailableTool[];
  skippedTools: Array<{ tool: ResearchAvailableTool; reason: string }>;
}): ResearchApiResponse {
  if (params.payload.status === "failed") {
    throw new ResearchApiError(
      params.payload.error?.message?.trim() || "OpenAI response failed.",
      {
        status: 200,
        code: params.payload.error?.code,
      },
    );
  }
  const text = extractResponseText(params.payload);
  if (!text) {
    throw new Error("OpenAI response did not contain assistant text output.");
  }
  return {
    id: params.payload.id,
    text,
    model: params.payload.model,
    usage: params.payload.usage
      ? {
          inputTokens: params.payload.usage.input_tokens,
          outputTokens: params.payload.usage.output_tokens,
          totalTokens: params.payload.usage.total_tokens,
        }
      : undefined,
    attachedTools: params.attachedTools,
    skippedTools: params.skippedTools,
  };
}

async function createResponse(params: {
  fetchImpl: typeof fetch;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  body: Record<string, unknown>;
}): Promise<z.infer<typeof ResponseSchema>> {
  const response = await fetchWithTimeout({
    fetchImpl: params.fetchImpl,
    url: `${params.baseUrl}/responses`,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(params.body),
    },
    timeoutMs: params.timeoutMs,
    timeoutMessage: `Research API create request timed out after ${params.timeoutMs} ms.`,
  });

  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new ResearchApiError(`OpenAI Responses API error: ${parsed.message}`, {
      status: response.status,
      code: parsed.code,
      param: parsed.param,
    });
  }

  return ResponseSchema.parse(await response.json());
}

async function retrieveResponse(params: {
  fetchImpl: typeof fetch;
  baseUrl: string;
  apiKey: string;
  responseId: string;
  timeoutMs: number;
}): Promise<z.infer<typeof ResponseSchema>> {
  const response = await fetchWithTimeout({
    fetchImpl: params.fetchImpl,
    url: `${params.baseUrl}/responses/${params.responseId}`,
    init: {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
      },
    },
    timeoutMs: params.timeoutMs,
    timeoutMessage: `Research API poll request timed out after ${params.timeoutMs} ms.`,
  });

  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new ResearchApiError(`OpenAI Responses API error: ${parsed.message}`, {
      status: response.status,
      code: parsed.code,
      param: parsed.param,
    });
  }

  return ResponseSchema.parse(await response.json());
}

function buildResponseRequestBody(params: {
  model: string;
  instructions: string;
  input: string;
  previousResponseId?: string;
  maxOutputTokens?: number;
  reasoningEffort: "none" | "low" | "medium" | "high" | "xhigh";
  tools: Record<string, unknown>[];
  background: boolean;
}): Record<string, unknown> {
  return {
    model: params.model,
    instructions: params.instructions,
    input: params.input,
    previous_response_id: params.previousResponseId,
    max_output_tokens: params.maxOutputTokens ?? 12000,
    background: params.background,
    parallel_tool_calls: true,
    store: true,
    reasoning: {
      effort: params.reasoningEffort,
    },
    tools: params.tools,
    tool_choice: params.tools.length > 0 ? "auto" : "none",
  };
}

export async function runResearchApiRequest(
  opts: ResearchApiRequestOptions,
): Promise<ResearchApiResponse> {
  const model = normalizeModel(opts.model);
  const apiKey = resolveApiKey(opts);
  const baseUrl = resolveApiBaseUrl(opts);
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const { attachedTools, skippedTools, tools } = resolveTools(
    model,
    baseUrl,
    opts.env,
    opts.allowedTools,
  );
  const reasoningEffort = resolveReasoningEffort(model, opts.thinking);
  const requestTimeoutMs = resolveRequestTimeoutMs(opts);
  const responseMode = resolveResponseMode(opts);
  const pollIntervalMs = resolvePollIntervalMs(opts);
  const requestBody = buildResponseRequestBody({
    model,
    instructions: opts.instructions,
    input: opts.input,
    previousResponseId: opts.previousResponseId,
    maxOutputTokens: opts.maxOutputTokens,
    reasoningEffort,
    tools,
    background: responseMode === "poll" || model === "gpt-5.4-pro",
  });

  if (responseMode === "sync") {
    const payload = await createResponse({
      fetchImpl,
      baseUrl,
      apiKey,
      timeoutMs: requestTimeoutMs,
      body: requestBody,
    });
    return toResearchApiResponse({
      payload,
      attachedTools,
      skippedTools,
    });
  }

  const deadline = Date.now() + requestTimeoutMs;
  let payload = await createResponse({
    fetchImpl,
    baseUrl,
    apiKey,
    timeoutMs: requestTimeoutMs,
    body: requestBody,
  });

  while (payload.status === "queued" || payload.status === "in_progress") {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error(
        `Research background response ${payload.id} did not complete after ${requestTimeoutMs} ms.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remainingMs)));
    payload = await retrieveResponse({
      fetchImpl,
      baseUrl,
      apiKey,
      responseId: payload.id,
      timeoutMs: Math.min(requestTimeoutMs, Math.max(1_000, remainingMs)),
    });
  }

  return toResearchApiResponse({
    payload,
    attachedTools,
    skippedTools,
  });
}
