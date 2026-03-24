#!/usr/bin/env bash
set -euo pipefail

ROOT="/home/jin/research-god"
OUT="$ROOT/research"

cd "$ROOT"

find "$OUT" -mindepth 1 -maxdepth 1 ! -name manuscript -exec rm -rf {} +

node --import tsx <<'EOF'
const { researchRunCommand } = await import("./src/commands/research.ts");

const IDEA = "更好的test time computation的方法 针对开放领域科学发现任务比如 hivemind";

function stripNulls(value) {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, stripNulls(entry)]),
    );
  }
  return value;
}

const fetchImpl = async (input, init) => {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (!/application\/json/i.test(contentType) && !/\/responses(?:\/|\\?|$)/.test(url)) {
    return response;
  }

  const rawText = await response.text();
  try {
    const parsed = JSON.parse(rawText);
    const cleaned = stripNulls(parsed);
    return new Response(JSON.stringify(cleaned), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch {
    return new Response(rawText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }
};

const runtime = {
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  exit(code) {
    throw new Error(`runtime.exit(${code})`);
  },
};

const result = await researchRunCommand(runtime, {
  idea: IDEA,
  count: 1,
  out: "/home/jin/research-god/research",
  model: "openai/gpt-5.4",
  thinking: "xhigh",
  responseMode: "poll",
  pollIntervalMs: 10_000,
  env: process.env,
  requestTimeoutMs: 7_200_000,
  fetchImpl,
  wakeMainSession: async () => {},
});

console.log("RUN_RESULT_JSON_START");
console.log(
  JSON.stringify(
    {
      outputDir: result.outputDir,
      ideaPath: result.ideaPath,
      layoutPath: result.layoutPath,
      specificationPath: result.specificationPath,
      referencesPath: result.referencesPath,
      todoPath: result.todoPath,
      stages: result.report.stages,
      model: result.report.model,
      thinking: result.report.thinking,
      responseMode: "poll",
      pollIntervalMs: 10_000,
    },
    null,
    2,
  ),
);
console.log("RUN_RESULT_JSON_END");
EOF
