import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { extractPdfTextPagesMock } = vi.hoisted(() => ({
  extractPdfTextPagesMock: vi.fn(),
}));

vi.mock("../media/pdf-extract.js", () => ({
  extractPdfTextPages: extractPdfTextPagesMock,
}));

import { researchRunCommand, researchTickCommand } from "./research.js";

async function makeTempDir(prefix: string) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createManuscriptTemplate(root: string) {
  const manuscriptDir = path.join(root, "manuscript", "sections");
  await fs.mkdir(manuscriptDir, { recursive: true });
  await fs.writeFile(path.join(root, "manuscript", "main.tex"), "\\input{sections/introduction}\n");
  await fs.writeFile(path.join(manuscriptDir, "introduction.tex"), "% introduction\n");
}

function buildResponsesJson(params: { id: string; text: string }) {
  return {
    id: params.id,
    object: "response",
    created_at: 1_763_011_200,
    status: "completed",
    model: "gpt-5.4",
    output: [
      {
        type: "message",
        id: `msg_${params.id}`,
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: params.text }],
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    },
  };
}

function buildTodoItems() {
  return [
    {
      id: "T01",
      title: "closed-loop scope",
      workerType: "coding" as const,
      objective: "Lock the scope and first experiment boundary.",
      acceptance: ["Scope and baseline are fixed"],
      status: "pending" as const,
      subtasksDir: "tasks/T01/",
    },
    {
      id: "T02",
      title: "closed-loop data",
      workerType: "coding" as const,
      objective: "Prepare the data slice.",
      acceptance: ["Data slice exists"],
      status: "pending" as const,
      subtasksDir: "tasks/T02/",
    },
    {
      id: "T03",
      title: "closed-loop baseline",
      workerType: "coding" as const,
      objective: "Implement the baseline.",
      acceptance: ["Baseline runs"],
      status: "pending" as const,
      subtasksDir: "tasks/T03/",
    },
    {
      id: "T04",
      title: "closed-loop evaluation",
      workerType: "coding" as const,
      objective: "Run the evaluation.",
      acceptance: ["Metrics are recorded"],
      status: "pending" as const,
      subtasksDir: "tasks/T04/",
    },
    {
      id: "T05",
      title: "closed-loop writing",
      workerType: "writing" as const,
      objective: "Draft the section-level manuscript content.",
      acceptance: ["Writing inputs are aligned"],
      status: "pending" as const,
      subtasksDir: "tasks/T05/",
    },
    {
      id: "T06",
      title: "closed-loop manuscript polish",
      workerType: "writing" as const,
      objective: "Polish the final manuscript.",
      acceptance: ["Manuscript polish is done"],
      status: "pending" as const,
      subtasksDir: "tasks/T06/",
    },
  ];
}

function buildSpecificationMarkdown() {
  return [
    "# 研究规范",
    "",
    "## 问题定义",
    "",
    "验证从 idea 到 section 写作的最小闭环。",
    "",
    "## 范围",
    "",
    "只覆盖 introduction 的最小工作流。",
    "",
    "## 方法",
    "- 生成 workspace",
    "- 生成 citation 与 exemplar",
    "- 逐 task 调度",
    "",
    "## 评估",
    "- workspace 产物齐全",
    "- coding 失败后可重规划",
    "- writing 可写出 LaTeX",
    "",
    "## 风险",
    "- 角色切换可能丢失状态",
    "",
    "## 资源",
    "",
    "### Backbone",
    "- 名称：OpenClaw",
    "- 地址：https://example.com/backbone",
    "- 备注：用于集成验收。",
    "",
    "### 数据集",
    "- 名称：WorkflowBench",
    "- 地址：https://example.com/dataset",
    "- 备注：仅用于集成测试。",
    "",
    "### 对比方法",
    "- 名称：Baseline",
    "- 地址：https://example.com/baseline",
    "- 备注：集成基线。",
    "",
    "## 执行说明",
    "",
    "### 环境",
    "- Node.js",
    "",
    "### 入口",
    "- 路径：src/index.ts",
    "- 用途：集成验收入口。",
    "",
    "### 数据准备命令",
    "- pnpm prepare",
    "",
    "### 训练命令",
    "- pnpm test",
    "",
    "### 评估命令",
    "- pnpm test",
    "",
    "### 预期产物",
    "- layout.md",
    "- references.bib",
    "- manuscript/sections/introduction.tex",
    "",
  ].join("\n");
}

async function writeCodingTaskOutputs(
  root: string,
  taskId: string,
  params: { status: "done" | "blocked"; summary: string; logLine: string },
) {
  const taskDir = path.join(root, "tasks", taskId);
  await Promise.all([
    fs.writeFile(path.join(taskDir, "summary.md"), `# Summary\n\n- ${params.summary}\n`, "utf-8"),
    fs.writeFile(
      path.join(taskDir, "outputs", "result.json"),
      `${JSON.stringify(
        {
          taskId,
          success: params.status === "done",
          command: "pnpm test",
          metrics: { status: params.status },
          output_paths: [`tasks/${taskId}/summary.md`],
        },
        null,
        2,
      )}\n`,
      "utf-8",
    ),
    fs.appendFile(path.join(taskDir, "logs", "run.log"), `${params.logLine}\n`, "utf-8"),
  ]);
}

async function markTaskPlanDone(root: string, taskId: string) {
  const taskPath = path.join(root, "tasks", taskId, "plan.md");
  const current = await fs.readFile(taskPath, "utf-8");
  const next = current
    .replace(/\n## 状态\n(?:pending|in_progress)\n/, "\n## 状态\ndone\n")
    .replace(/- status: pending/g, "- status: done")
    .replace(/- status: in_progress/g, "- status: done")
    .replace(/\n## Blockers\n\n- [^\n]+\n/, "\n## Blockers\n\n- 暂无\n")
    .replace(/\n## 最近执行结果\n\n- [^\n]+\n/, "\n## 最近执行结果\n\n- 当前任务已完成。\n")
    .replace(/\n## Next Action Hint\n\n- [^\n]+\n/, "\n## Next Action Hint\n\n- 转到下一个顶层任务。\n");
  await fs.writeFile(taskPath, next, "utf-8");
}

async function collectFilesNamed(root: string, targetName: string): Promise<string[]> {
  const matches: string[] = [];
  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(absolutePath);
          return;
        }
        if (entry.name === targetName) {
          matches.push(path.relative(root, absolutePath).replace(/\\/g, "/"));
        }
      }),
    );
  }
  await walk(root);
  return matches.sort();
}

describe("research workflow e2e", () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirs.splice(0).map(async (dir) => await fs.rm(dir, { recursive: true, force: true })),
    );
    extractPdfTextPagesMock.mockReset();
    vi.restoreAllMocks();
  });

  it("runs the minimal closed loop from live research run to replanning and section writing", async () => {
    const root = await makeTempDir("openclaw-research-workflow-e2e-");
    createdDirs.push(root);
    await createManuscriptTemplate(root);

    extractPdfTextPagesMock.mockImplementation(async ({ buffer }: { buffer: Buffer }) => {
      const label = buffer.toString("utf-8");
      return [
        [
          "Abstract",
          `${label} abstract summary.`,
          "",
          "Introduction",
          `${label} introduction guidance.`,
          "",
          "Method",
          `${label} method guidance.`,
          "",
          "Conclusion",
          `${label} conclusion guidance.`,
        ].join("\n"),
      ];
    });

    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_idea",
              text: JSON.stringify({
                refinedIdea: "Close the loop from research planning to section writing.",
                sections: [{ id: "S01", name: "introduction" }],
              }),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_writing_structure",
              text: JSON.stringify({
                sections: [
                  {
                    id: "S01",
                    name: "introduction",
                    writingGoal: "Establish the problem gap, why the closed loop matters, and the concrete paper claim.",
                    keyPoints: [
                      "Define the workflow gap from idea refinement to section writing.",
                      "State the main claim about a minimal closed-loop pipeline.",
                    ],
                    questionsToAnswer: [
                      "Why is the current workflow brittle without a section-level writing contract?",
                    ],
                    avoidPatterns: [
                      "Do not turn the introduction into a generic literature survey.",
                    ],
                    requiredContext: ["references_bib", "literature_review", "existing_tex"],
                  },
                ],
              }),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_spec",
              text: buildSpecificationMarkdown(),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_paper",
              text: [
                "===BIB===",
                "@inproceedings{loop2026a,",
                "  title = {Closed Loop Intro Patterns},",
                "  author = {OpenClaw Research},",
                "  year = {2026},",
                "  booktitle = {WorkflowConf},",
                "}",
                "",
                "@inproceedings{loop2026b,",
                "  title = {Section-Wise Writing Contracts},",
                "  author = {OpenClaw Research},",
                "  year = {2026},",
                "  booktitle = {WorkflowConf},",
                "}",
                "",
                "===PAPERS===",
                "## introduction",
                "",
                "### Closed Loop Intro Patterns",
                "loop2026a",
                "",
                "Supports the introduction motivation.",
                "",
                "### Section-Wise Writing Contracts",
                "loop2026b",
                "",
                "Supports the section-writing execution contract.",
                "",
                "===EXEMPLARS===",
                "## introduction",
                "",
                "### Closed Loop Intro Patterns",
                "- citation_key: loop2026a",
                "- pdf_url: https://example.com/paper-01.pdf",
                "- short_intro: Concise introduction exemplar.",
                "- why_relevant: It shows how to motivate the research problem quickly.",
                "",
                "### Section-Wise Writing Contracts",
                "- citation_key: loop2026b",
                "- pdf_url: https://example.com/paper-02.pdf",
                "- short_intro: Concise writing-contract exemplar.",
                "- why_relevant: It shows how to structure section-level execution details.",
                "",
                "===LITERATURE_REVIEW===",
                "# Literature Review",
                "",
                "## introduction",
                "",
                "Both papers help frame the introduction and execution contract.",
              ].join("\n"),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_todo",
              text: JSON.stringify({
                todo: buildTodoItems(),
              }),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(new Response(Buffer.from("paper-01", "utf-8")))
      .mockResolvedValueOnce(new Response(Buffer.from("paper-02", "utf-8")));

    const runResult = await researchRunCommand(runtime, {
      idea: "rough idea: close the loop from idea to writing",
      out: root,
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl,
      wakeMainSession,
      now: new Date("2026-03-22T09:00:00.000Z"),
    });

    expect(runResult.report.sections).toHaveLength(1);
    expect(wakeMainSession).toHaveBeenCalledWith({ json: false });
    await expect(
      fs.readFile(path.join(root, "section_materials", "introduction", "citations.md"), "utf-8"),
    ).resolves.toContain("loop2026a");
    await expect(
      fs.readFile(path.join(root, "section_materials", "introduction", "papers", "paper_01", "meta.md"), "utf-8"),
    ).resolves.toContain("loop2026a");
    await expect(
      fs.readFile(path.join(root, "section_materials", "introduction", "brief.md"), "utf-8"),
    ).resolves.toContain("## Must Cover");
    await expect(
      fs.readFile(path.join(root, "section_materials", "introduction", "papers", "paper_01", "source.pdf")),
    ).resolves.toBeTruthy();
    await expect(
      fs.readFile(
        path.join(
          root,
          "section_materials",
          "introduction",
          "papers",
          "paper_01",
          "source_sections",
          "02-introduction.md",
        ),
        "utf-8",
      ),
    ).resolves.toContain("paper-01 introduction guidance");
    await expect(
      fs.readFile(
        path.join(
          root,
          "section_materials",
          "introduction",
          "papers",
          "paper_02",
          "source_sections",
          "02-introduction.md",
        ),
        "utf-8",
      ),
    ).resolves.toContain("paper-02 introduction guidance");

    await fs.rm(path.join(root, "tasks", "T01", "plan.md"));

    const firstTick = await researchTickCommand(runtime, {
      workspace: root,
      now: new Date("2026-03-22T09:01:00.000Z"),
      roleRunner: vi.fn().mockImplementation(async ({ role, workspaceDir, taskId }) => {
        expect(role).toBe("step_planner");
        await fs.writeFile(
          path.join(workspaceDir, "tasks", taskId, "plan.md"),
          [
            "# T01 closed-loop scope",
            "",
            "## Worker Type",
            "coding",
            "",
            "## 状态",
            "pending",
            "",
            "## 目标",
            "Lock the scope and first experiment boundary.",
            "",
            "## 验收标准",
            "- Scope and baseline are fixed",
            "",
            "## Step List",
            "",
            "### S01",
            "- status: pending",
            "- task: Clarify the scope statement and baseline boundary.",
            "- acceptance: Scope and baseline are fixed",
            "",
            "## Blockers",
            "- 暂无",
            "",
            "## 最近执行结果",
            "- Step Planner created the executable plan.",
            "",
            "## Next Action Hint",
            "- Execute S01 in coding.",
            "",
          ].join("\n"),
          "utf-8",
        );
        return {
          status: "done" as const,
          summary: "planner wrote the initial executable plan",
          updated_files: ["tasks/T01/plan.md"],
          needs_replan: false,
          needs_long_job: false,
          long_job_request: "",
          artifacts: [],
          rawStdout: [
            "RESULT: done",
            "SUMMARY: planner wrote the initial executable plan",
            "PLAN_UPDATE: wrote tasks/T01/plan.md",
            "NEXT_HINT: dispatch coding",
          ].join("\n"),
          rawStderr: "",
          exitCode: 0,
          stdoutBrief: {
            result: "done" as const,
            summary: "planner wrote the initial executable plan",
            planUpdate: "wrote tasks/T01/plan.md",
            nextHint: "dispatch coding",
          },
        };
      }),
    });
    expect(firstTick.action).toBe("dispatched_step_planner");

    const secondTick = await researchTickCommand(runtime, {
      workspace: root,
      now: new Date("2026-03-22T09:02:00.000Z"),
      roleRunner: vi.fn().mockImplementation(async ({ role, workspaceDir, taskId }) => {
        expect(role).toBe("coding_agent");
        await fs.writeFile(
          path.join(workspaceDir, "tasks", taskId, "plan.md"),
          [
            "# T01 closed-loop scope",
            "",
            "## Worker Type",
            "coding",
            "",
            "## 状态",
            "in_progress",
            "",
            "## 目标",
            "Lock the scope and first experiment boundary.",
            "",
            "## 验收标准",
            "- Scope and baseline are fixed",
            "",
            "## Step List",
            "",
            "### S01",
            "- status: in_progress",
            "- task: Clarify the scope statement and baseline boundary.",
            "- acceptance: Scope and baseline are fixed",
            "",
            "## Blockers",
            "- Baseline evidence is missing, current coding path cannot continue.",
            "",
            "## 最近执行结果",
            "- Coding failed because the baseline evidence was incomplete.",
            "",
            "## Next Action Hint",
            "- Return to Step Planner and shrink the first step.",
            "",
          ].join("\n"),
          "utf-8",
        );
        await writeCodingTaskOutputs(workspaceDir, taskId, {
          status: "blocked",
          summary: "coding failed and requested replanning",
          logLine: "[blocked] baseline evidence missing",
        });
        return {
          status: "blocked" as const,
          summary: "coding failed and requested replanning",
          updated_files: [
            "tasks/T01/plan.md",
            "tasks/T01/summary.md",
            "tasks/T01/outputs/result.json",
            "tasks/T01/logs/run.log",
          ],
          needs_replan: true,
          needs_long_job: false,
          long_job_request: "",
          artifacts: [],
          rawStdout: [
            "RESULT: blocked",
            "SUMMARY: coding failed and requested replanning",
            "PLAN_UPDATE: wrote blocker into tasks/T01/plan.md",
            "NEXT_HINT: return to Step Planner",
          ].join("\n"),
          rawStderr: "",
          exitCode: 0,
          stdoutBrief: {
            result: "blocked" as const,
            summary: "coding failed and requested replanning",
            planUpdate: "wrote blocker into tasks/T01/plan.md",
            nextHint: "return to Step Planner",
          },
        };
      }),
    });
    expect(secondTick.action).toBe("dispatched_coding_agent");

    const thirdTick = await researchTickCommand(runtime, {
      workspace: root,
      now: new Date("2026-03-22T09:03:00.000Z"),
      roleRunner: vi.fn().mockImplementation(async ({ role, workspaceDir, taskId }) => {
        expect(role).toBe("step_planner");
        await fs.writeFile(
          path.join(workspaceDir, "tasks", taskId, "plan.md"),
          [
            "# T01 closed-loop scope",
            "",
            "## Worker Type",
            "coding",
            "",
            "## 状态",
            "in_progress",
            "",
            "## 目标",
            "Lock the scope and first experiment boundary.",
            "",
            "## 验收标准",
            "- Scope and baseline are fixed",
            "",
            "## Step List",
            "",
            "### S01",
            "- status: pending",
            "- task: Freeze a smaller scope statement with one verified baseline only.",
            "- acceptance: A smaller verified scope statement is written",
            "",
            "## Blockers",
            "- 暂无",
            "",
            "## 最近执行结果",
            "- Step Planner replaced the blocked path with a smaller verified step.",
            "",
            "## Next Action Hint",
            "- Re-run coding on the narrowed scope.",
            "",
          ].join("\n"),
          "utf-8",
        );
        return {
          status: "done" as const,
          summary: "planner rewrote the blocked plan",
          updated_files: ["tasks/T01/plan.md"],
          needs_replan: false,
          needs_long_job: false,
          long_job_request: "",
          artifacts: [],
          rawStdout: [
            "RESULT: done",
            "SUMMARY: planner rewrote the blocked plan",
            "PLAN_UPDATE: replaced the blocked step with a smaller plan",
            "NEXT_HINT: dispatch coding again",
          ].join("\n"),
          rawStderr: "",
          exitCode: 0,
          stdoutBrief: {
            result: "done" as const,
            summary: "planner rewrote the blocked plan",
            planUpdate: "replaced the blocked step with a smaller plan",
            nextHint: "dispatch coding again",
          },
        };
      }),
    });
    expect(thirdTick.action).toBe("dispatched_step_planner");

    const historyDir = path.join(root, "tasks", "T01", "history");
    const historyEntries = await fs.readdir(historyDir);
    expect(historyEntries).toHaveLength(1);
    await expect(fs.readFile(path.join(historyDir, historyEntries[0] ?? ""), "utf-8")).resolves.toContain(
      "Baseline evidence is missing",
    );

    const fourthTick = await researchTickCommand(runtime, {
      workspace: root,
      now: new Date("2026-03-22T09:04:00.000Z"),
      roleRunner: vi.fn().mockImplementation(async ({ role, workspaceDir, taskId }) => {
        expect(role).toBe("coding_agent");
        await fs.writeFile(
          path.join(workspaceDir, "tasks", taskId, "plan.md"),
          [
            "# T01 closed-loop scope",
            "",
            "## Worker Type",
            "coding",
            "",
            "## 状态",
            "done",
            "",
            "## 目标",
            "Lock the scope and first experiment boundary.",
            "",
            "## 验收标准",
            "- Scope and baseline are fixed",
            "",
            "## Step List",
            "",
            "### S01",
            "- status: done",
            "- task: Freeze a smaller scope statement with one verified baseline only.",
            "- acceptance: A smaller verified scope statement is written",
            "",
            "## Blockers",
            "- 暂无",
            "",
            "## 最近执行结果",
            "- Coding completed the narrowed scope successfully.",
            "",
            "## Next Action Hint",
            "- Move to the next top-level task.",
            "",
          ].join("\n"),
          "utf-8",
        );
        await writeCodingTaskOutputs(workspaceDir, taskId, {
          status: "done",
          summary: "coding completed the narrowed scope",
          logLine: "[done] narrowed scope completed",
        });
        return {
          status: "done" as const,
          summary: "coding completed the narrowed scope",
          updated_files: [
            "tasks/T01/plan.md",
            "tasks/T01/summary.md",
            "tasks/T01/outputs/result.json",
            "tasks/T01/logs/run.log",
          ],
          needs_replan: false,
          needs_long_job: false,
          long_job_request: "",
          artifacts: [],
          rawStdout: [
            "RESULT: done",
            "SUMMARY: coding completed the narrowed scope",
            "PLAN_UPDATE: marked S01 as done",
            "NEXT_HINT: move to the next task",
          ].join("\n"),
          rawStderr: "",
          exitCode: 0,
          stdoutBrief: {
            result: "done" as const,
            summary: "coding completed the narrowed scope",
            planUpdate: "marked S01 as done",
            nextHint: "move to the next task",
          },
        };
      }),
    });
    expect(fourthTick.action).toBe("dispatched_coding_agent");

    await Promise.all([
      markTaskPlanDone(root, "T02"),
      markTaskPlanDone(root, "T03"),
      markTaskPlanDone(root, "T04"),
      markTaskPlanDone(root, "T06"),
    ]);
    const paper01SourceSections = (
      await fs.readdir(
        path.join(root, "section_materials", "introduction", "papers", "paper_01", "source_sections"),
      )
    )
      .filter((entry) => entry.endsWith(".md"))
      .sort();
    const paper02SourceSections = (
      await fs.readdir(
        path.join(root, "section_materials", "introduction", "papers", "paper_02", "source_sections"),
      )
    )
      .filter((entry) => entry.endsWith(".md"))
      .sort();
    await fs.writeFile(
      path.join(root, "section_materials", "introduction", "brief.md"),
      [
        "# introduction Brief",
        "",
        "- section_id: S01",
        "- section_title: introduction",
        "- writing_goal: Turn the closed-loop research artifacts into a concise introduction.",
        "- latex_output_path: manuscript/sections/introduction.tex",
        "",
        "## Questions To Answer",
        "",
        "- Why does this workflow matter?",
        "",
        "## Avoid",
        "",
        "- Do not turn the introduction into a raw literature dump.",
        "",
        "## Source Section Mapping",
        "",
        `- source_section_path: section_materials/introduction/papers/paper_01/source_sections/${paper01SourceSections[1] ?? paper01SourceSections[0]}`,
        "  - citation_key: loop2026a",
        `- source_section_path: section_materials/introduction/papers/paper_02/source_sections/${paper02SourceSections[1] ?? paper02SourceSections[0]}`,
        "  - citation_key: loop2026b",
        "",
        "## Additional Reads",
        "",
        "- references_bib: references.bib",
        "- literature_review: literature_review.md",
        "- experiment_result_paths: none",
        "- existing_tex_paths:",
        "  - manuscript/sections/introduction.tex",
        "",
      ].join("\n"),
      "utf-8",
    );
    await fs.writeFile(
      path.join(root, "tasks", "T05", "plan.md"),
      [
        "# T05 closed-loop writing",
        "",
        "## Worker Type",
        "writing",
        "",
        "## 状态",
        "pending",
        "",
        "## 目标",
        "Draft the section-level manuscript content.",
        "",
        "## 验收标准",
        "- Writing inputs are aligned",
        "",
        "## Section Queue",
        "",
        "### W01",
        "- status: pending",
        "- section_id: S01",
        "- section_slug: introduction",
        "- materials_dir: section_materials/introduction/",
        "- manuscript_path: manuscript/sections/introduction.tex",
        "- acceptance: introduction saved as LaTeX and cites valid keys",
        "",
        "## Blockers",
        "- 暂无",
        "",
        "## 最近执行结果",
        "- 暂无",
        "",
        "## Next Action Hint",
        "- 从 W01 开始，先核对首节的 brief、citations 与 manuscript 路径。",
        "",
      ].join("\n"),
      "utf-8",
    );

    const fifthTick = await researchTickCommand(runtime, {
      workspace: root,
      now: new Date("2026-03-22T09:05:00.000Z"),
      roleRunner: vi.fn().mockImplementation(async ({ role, workspaceDir, taskId }) => {
        expect(role).toBe("writing_agent");
        expect(taskId).toBe("T05");
        const planPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
        const current = await fs.readFile(planPath, "utf-8");
        await fs.writeFile(
          planPath,
          current
            .replace("### W01\n- status: pending", "### W01\n- status: done")
            .replace(
              "\n## 最近执行结果\n\n- 暂无\n",
              "\n## 最近执行结果\n\n- Writing Agent wrote the introduction section.\n",
            )
            .replace(
              "\n## Next Action Hint\n\n- 从 W01 开始，先核对首节的 brief、citations 与 manuscript 路径。\n",
              "\n## Next Action Hint\n\n- Move to the next writing task.\n",
            ),
          "utf-8",
        );
        await fs.writeFile(
          path.join(workspaceDir, "manuscript", "sections", "introduction.tex"),
          "\\section{Introduction}\nWe close the loop with prior work \\cite{loop2026a,loop2026b}.\n",
          "utf-8",
        );
        return {
          status: "done" as const,
          summary: "writing completed the introduction section",
          updated_files: ["tasks/T05/plan.md", "manuscript/sections/introduction.tex"],
          needs_replan: false,
          needs_long_job: false,
          long_job_request: "",
          artifacts: ["manuscript/sections/introduction.tex"],
          rawStdout: [
            "RESULT: done",
            "SUMMARY: writing completed the introduction section",
            "PLAN_UPDATE: marked W01 as done",
            "NEXT_HINT: move to the next writing task",
          ].join("\n"),
          rawStderr: "",
          exitCode: 0,
          stdoutBrief: {
            result: "done" as const,
            summary: "writing completed the introduction section",
            planUpdate: "marked W01 as done",
            nextHint: "move to the next writing task",
          },
        };
      }),
    });

    expect(fifthTick.action).toBe("dispatched_writing_agent");
    await expect(
      fs.readFile(path.join(root, "manuscript", "sections", "introduction.tex"), "utf-8"),
    ).resolves.toContain("\\cite{loop2026a,loop2026b}");
    await expect(
      fs.readFile(path.join(root, "tasks", "T01", "summary.md"), "utf-8"),
    ).resolves.toContain("coding completed the narrowed scope");
    await expect(
      fs.readFile(path.join(root, "tasks", "T01", "outputs", "result.json"), "utf-8"),
    ).resolves.toContain('"success": true');
    await expect(
      fs.readFile(path.join(root, "tasks", "T01", "logs", "run.log"), "utf-8"),
    ).resolves.toContain("[done] narrowed scope completed");

    const statusFiles = await collectFilesNamed(root, "status.json");
    expect(statusFiles).toEqual([]);
  });
});
