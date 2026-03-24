import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RESEARCH_POLL_INTERVAL_MS,
  DEFAULT_RESEARCH_REQUEST_TIMEOUT_MS,
  runResearchApiRequest,
} from "./research.openai.js";

function buildResponsesJson(text: string) {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1_763_011_200,
    status: "completed",
    model: "gpt-5.4",
    output: [
      {
        type: "message",
        id: "msg_test",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text }],
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    },
  };
}

describe("runResearchApiRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies the default two-hour timeout to one /responses request", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(buildResponsesJson('{"ok":true}')), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await runResearchApiRequest({
      model: "openai/gpt-5.4",
      thinking: "xhigh",
      instructions: "Return JSON only.",
      input: "test",
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1",
      fetchImpl,
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      DEFAULT_RESEARCH_REQUEST_TIMEOUT_MS,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/v1/responses",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("uses an explicit timeout override when provided", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(buildResponsesJson("ok")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await runResearchApiRequest({
      model: "openai/gpt-5.4",
      thinking: "low",
      instructions: "Return text only.",
      input: "test",
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1",
      requestTimeoutMs: 12_345,
      fetchImpl,
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 12_345);
  });

  it("supports poll mode by creating a background response and retrieving it until completion", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_poll",
            object: "response",
            status: "queued",
            model: "gpt-5.4",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_poll",
            object: "response",
            status: "in_progress",
            model: "gpt-5.4",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(buildResponsesJson("poll-complete")), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const result = await runResearchApiRequest({
      model: "openai/gpt-5.4",
      thinking: "xhigh",
      instructions: "Return text only.",
      input: "test",
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1",
      responseMode: "poll",
      pollIntervalMs: 0,
      fetchImpl,
    });

    expect(result.text).toBe("poll-complete");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/v1/responses",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        background: true,
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/v1/responses/resp_poll",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/v1/responses/resp_poll",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("uses the default poll interval when poll mode is enabled without an override", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_poll",
            object: "response",
            status: "queued",
            model: "gpt-5.4",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(buildResponsesJson("done")), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await runResearchApiRequest({
      model: "openai/gpt-5.4",
      thinking: "medium",
      instructions: "Return text only.",
      input: "test",
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1",
      responseMode: "poll",
      pollIntervalMs: undefined,
      fetchImpl,
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      DEFAULT_RESEARCH_POLL_INTERVAL_MS,
    );
  });
});
