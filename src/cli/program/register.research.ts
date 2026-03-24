import type { Command } from "commander";
import {
  RESEARCH_MODELS,
  RESEARCH_RESPONSE_MODES,
  RESEARCH_THINKING_LEVELS,
  researchRunCommand,
  researchSuperviseJobCliCommand,
  researchTickCommand,
} from "../../commands/research.js";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";

export function registerResearchCommand(program: Command) {
  const research = program.command("research").description("Generate research reports and specs");
  research.action(() => {
    research.help({ error: true });
  });

  research
    .command("run")
    .description("Generate one research report bundle from an idea prompt")
    .option("--idea <text>", "Seed idea text")
    .option("--idea-file <path>", "Read the seed idea from a file")
    .option("--count <n>", "Number of candidate idea variants to expand", "3")
    .option("--model <id>", `Model id: ${RESEARCH_MODELS.join("|")}`, RESEARCH_MODELS[0])
    .option("--thinking <level>", `Thinking level: ${RESEARCH_THINKING_LEVELS.join("|")}`, "xhigh")
    .option(
      "--response-mode <mode>",
      `Responses API execution mode: ${RESEARCH_RESPONSE_MODES.join("|")}`,
      "sync",
    )
    .option(
      "--poll-interval-ms <ms>",
      "When --response-mode=poll, wait this many milliseconds between GET /responses/{id} polls",
      "5000",
    )
    .option(
      "--request-timeout-ms <ms>",
      "Sync mode: timeout for one /responses request. Poll mode: total background wait budget in milliseconds",
      "7200000",
    )
    .option("--out <dir>", "Output directory")
    .option("--json", "Print machine-readable result JSON", false)
    .option("--dry-run", "Skip OpenAI API calls and generate placeholder output", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          [
            'openclaw research run --idea "multi-agent paper ideation for HCI"',
            "Run the four-stage research pipeline with OpenAI Responses API.",
          ],
          [
            "openclaw research run --idea-file ./notes.txt --count 5 --dry-run",
            "Read the seed idea from a file and expand five candidate directions.",
          ],
          [
            'openclaw research run --idea "LLM-assisted literature triage" --model openai/gpt-5.4-pro --thinking xhigh --out ./research-output',
            "Write the run into a chosen output root with stronger reasoning settings.",
          ],
        ])}`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await researchRunCommand(defaultRuntime, {
          idea: opts.idea as string | undefined,
          ideaFile: opts.ideaFile as string | undefined,
          count: Number.parseInt(String(opts.count), 10),
          model: opts.model as string | undefined,
          thinking: opts.thinking as string | undefined,
          responseMode: opts.responseMode as string | undefined,
          pollIntervalMs: Number.parseInt(String(opts.pollIntervalMs), 10),
          requestTimeoutMs: Number.parseInt(String(opts.requestTimeoutMs), 10),
          out: opts.out as string | undefined,
          json: Boolean(opts.json),
          dryRun: Boolean(opts.dryRun),
        });
      });
    });

  research
    .command("tick")
    .description("Legacy compatibility/debug: advance the old research secretary tick once")
    .option("--workspace <dir>", "Workspace directory", ".")
    .option("--json", "Print machine-readable result JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          [
            "openclaw research tick --workspace .",
            "Legacy/debug only: run one old secretary tick inside the current workspace.",
          ],
          [
            'openclaw system event --text "检查当前 research workspace 的待办" --mode now',
            "Recommended main-thread wake entry for the new orchestration model.",
          ],
        ])}`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await researchTickCommand(defaultRuntime, {
          workspace: opts.workspace as string | undefined,
          json: Boolean(opts.json),
        });
      });
    });

  research
    .command("supervise-job")
    .description("Internal helper: wait for a prepared long job and finalize workspace artifacts")
    .requiredOption("--task <id>", "Task id, for example T04")
    .option("--workspace <dir>", "Workspace directory", ".")
    .option("--json", "Print machine-readable result JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        await researchSuperviseJobCliCommand(defaultRuntime, {
          workspace: opts.workspace as string | undefined,
          taskId: opts.task as string,
          json: Boolean(opts.json),
        });
      });
    });
}
