import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const researchRunCommand = vi.fn();
const researchTickCommand = vi.fn();
const researchSuperviseJobCliCommand = vi.fn();
const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

vi.mock("../../commands/research.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../commands/research.js")>();
  return {
    ...actual,
    researchRunCommand,
    researchTickCommand,
    researchSuperviseJobCliCommand,
  };
});

vi.mock("../../runtime.js", () => ({
  defaultRuntime: runtime,
}));

let registerResearchCommand: typeof import("./register.research.js").registerResearchCommand;

beforeAll(async () => {
  ({ registerResearchCommand } = await import("./register.research.js"));
});

describe("registerResearchCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    researchRunCommand.mockResolvedValue(undefined);
    researchTickCommand.mockResolvedValue(undefined);
    researchSuperviseJobCliCommand.mockResolvedValue(undefined);
  });

  it("parses research run options and forwards them to the command", async () => {
    const program = new Command();
    registerResearchCommand(program);

    await program.parseAsync(
      [
        "research",
        "run",
        "--idea",
        "spec-driven paper planning",
        "--count",
        "5",
        "--model",
        "openai/gpt-5.4-pro",
        "--thinking",
        "xhigh",
        "--response-mode",
        "poll",
        "--poll-interval-ms",
        "2500",
        "--request-timeout-ms",
        "7200000",
        "--out",
        "./reports",
        "--json",
        "--dry-run",
      ],
      { from: "user" },
    );

    expect(researchRunCommand).toHaveBeenCalledWith(runtime, {
      idea: "spec-driven paper planning",
      ideaFile: undefined,
      count: 5,
      model: "openai/gpt-5.4-pro",
      thinking: "xhigh",
      responseMode: "poll",
      pollIntervalMs: 2_500,
      requestTimeoutMs: 7_200_000,
      out: "./reports",
      json: true,
      dryRun: true,
    });
  });

  it("parses research tick options and forwards them to the command", async () => {
    const program = new Command();
    registerResearchCommand(program);

    await program.parseAsync(["research", "tick", "--workspace", "./workspace", "--json"], {
      from: "user",
    });

    expect(researchTickCommand).toHaveBeenCalledWith(runtime, {
      workspace: "./workspace",
      json: true,
    });
  });

  it("shows help when the root research command is invoked directly", async () => {
    const program = new Command().exitOverride();
    registerResearchCommand(program);
    const research = program.commands.find((command) => command.name() === "research");
    expect(research).toBeDefined();
    const helpSpy = vi.spyOn(research as Command, "help").mockImplementation(() => {
      throw new Error("help-called");
    });

    await expect(program.parseAsync(["research"], { from: "user" })).rejects.toThrow("help-called");
    expect(helpSpy).toHaveBeenCalledWith({ error: true });
  });

  it("parses research supervise-job options and forwards them to the command", async () => {
    const program = new Command();
    registerResearchCommand(program);

    await program.parseAsync(
      ["research", "supervise-job", "--workspace", "./workspace", "--task", "T04", "--json"],
      {
        from: "user",
      },
    );

    expect(researchSuperviseJobCliCommand).toHaveBeenCalledWith(runtime, {
      workspace: "./workspace",
      taskId: "T04",
      json: true,
    });
  });
});
