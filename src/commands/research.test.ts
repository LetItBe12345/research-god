import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RESEARCH_RUN_WAKE_TEXT,
  researchRunCommand,
  researchTickCommand,
  wakeMainSessionAfterLongJob,
  wakeMainSessionAfterResearchRun,
} from "./research.js";

async function makeTempDir(prefix: string) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

async function createManuscriptTemplate(root: string) {
  const manuscriptDir = path.join(root, "manuscript", "sections");
  await fs.mkdir(manuscriptDir, { recursive: true });
  await fs.writeFile(path.join(root, "manuscript", "main.tex"), "\\input{sections/introduction}\n");
  await Promise.all(
    ["introduction", "related-work", "method", "experiments", "conclusion"].map(
      async (section) =>
        await fs.writeFile(path.join(manuscriptDir, `${section}.tex`), `% ${section}\n`),
    ),
  );
}

async function markDryRunCodingTasksDone(root: string) {
  const codingTaskIds = ["T01", "T02", "T03", "T04"];
  await Promise.all(
    codingTaskIds.map(async (taskId) => {
      const taskPath = path.join(root, "tasks", taskId, "plan.md");
      const current = await fs.readFile(taskPath, "utf-8");
      const next = current
        .replace(/\n## 状态\n(?:pending|in_progress)\n/, "\n## 状态\ndone\n")
        .replace(/- status: pending/g, "- status: done")
        .replace(/- status: in_progress/g, "- status: done")
        .replace(
          /\n## 最近执行结果\n\n- 暂无\n/,
          "\n## 最近执行结果\n\n- 当前 coding 顶层任务已完成。\n",
        )
        .replace(
          /\n## Next Action Hint\n\n-[^\n]+\n/,
          "\n## Next Action Hint\n\n- 转到下一个顶层任务。\n",
        );
      await fs.writeFile(taskPath, next, "utf-8");
    }),
  );
}

async function prepareIntroductionWritingMaterials(root: string) {
  const materialsDir = path.join(root, "section_materials", "introduction");
  const paper01SourceDir = path.join(materialsDir, "papers", "paper_01", "source_sections");
  const paper02SourceDir = path.join(materialsDir, "papers", "paper_02", "source_sections");
  await fs.mkdir(paper01SourceDir, { recursive: true });
  await fs.mkdir(paper02SourceDir, { recursive: true });

  const paper01RelativePath =
    "section_materials/introduction/papers/paper_01/source_sections/01_introduction.md";
  const paper02RelativePath =
    "section_materials/introduction/papers/paper_02/source_sections/01_introduction.md";

  const sourceSectionMarkdown = (paperTitle: string, citationKey: string, sectionTitle: string) =>
    [
      `# ${sectionTitle}`,
      "",
      `- paper_title: ${paperTitle}`,
      `- citation_key: ${citationKey}`,
      `- section_title: ${sectionTitle}`,
      "- section_slug: introduction",
      "",
      "这是一段可供写作 worker 注入的榜样论文 section 材料。",
      "",
    ].join("\n");

  await Promise.all([
    fs.writeFile(
      path.join(root, paper01RelativePath),
      sourceSectionMarkdown("Dry Run Exemplar 1A", "dryrun1", "Introduction"),
      "utf-8",
    ),
    fs.writeFile(
      path.join(root, paper02RelativePath),
      sourceSectionMarkdown("Dry Run Exemplar 1B", "dryrun2", "Introduction"),
      "utf-8",
    ),
  ]);

  await fs.writeFile(
    path.join(materialsDir, "brief.md"),
    [
      "# introduction Brief",
      "",
      "- section_id: S01",
      "- section_title: introduction",
      "- writing_goal: 建立研究动机、问题缺口、方法主张和贡献列表。",
      "- latex_output_path: manuscript/sections/introduction.tex",
      "",
      "## Questions To Answer",
      "",
      "- 为什么这个问题值得研究？",
      "",
      "## Avoid",
      "",
      "- 不要把 introduction 写成 related work 文献罗列。",
      "",
      "## Source Section Mapping",
      "",
      `- source_section_path: ${paper01RelativePath}`,
      "  - citation_key: dryrun1",
      "  - paper_id: paper_01",
      "  - section_title: Introduction",
      "  - section_slug: introduction",
      "  - selection_reason: matched introduction semantics from paper_01",
      `- source_section_path: ${paper02RelativePath}`,
      "  - citation_key: dryrun2",
      "  - paper_id: paper_02",
      "  - section_title: Introduction",
      "  - section_slug: introduction",
      "  - selection_reason: matched introduction semantics from paper_02",
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
}

async function writeCodingTaskOutputs(
  root: string,
  taskId: string,
  params: { status: "done" | "blocked" | "failed"; summary: string; logLine: string },
) {
  const taskDir = path.join(root, "tasks", taskId);
  await Promise.all([
    fs.writeFile(path.join(taskDir, "summary.md"), `# Summary\n\n- ${params.summary}\n`, "utf-8"),
    fs.writeFile(
      path.join(taskDir, "outputs", "result.json"),
      `${JSON.stringify(
        {
          taskId,
          status: params.status,
          summary: params.summary,
        },
        null,
        2,
      )}\n`,
      "utf-8",
    ),
    fs.appendFile(path.join(taskDir, "logs", "run.log"), `${params.logLine}\n`, "utf-8"),
  ]);
}

async function writeWritingSectionOutput(root: string, section: string, content: string) {
  await fs.writeFile(path.join(root, "manuscript", "sections", `${section}.tex`), content, "utf-8");
}

function buildPlannerRoleResult(summary: string) {
  return {
    status: "done" as const,
    summary,
    updated_files: ["tasks/T01/plan.md"],
    needs_replan: false,
    needs_long_job: false,
    long_job_request: "",
    artifacts: [],
    rawStdout: [
      "RESULT: done",
      `SUMMARY: ${summary}`,
      "PLAN_UPDATE: 已写回 plan.md。",
      "NEXT_HINT: 继续按新计划推进。",
    ].join("\n"),
    rawStderr: "",
    exitCode: 0,
    stdoutBrief: {
      result: "done" as const,
      summary,
      planUpdate: "已写回 plan.md。",
      nextHint: "继续按新计划推进。",
    },
  };
}

function extractRequestBody(fetchImpl: ReturnType<typeof vi.fn>, callIndex: number) {
  const body = fetchImpl.mock.calls[callIndex]?.[1]?.body;
  if (typeof body !== "string") {
    throw new Error(`expected request body string at call ${callIndex}`);
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function buildResponsesJson(params: { id: string; model?: string; text: string }) {
  return {
    id: params.id,
    object: "response",
    created_at: 1_763_011_200,
    status: "completed",
    model: params.model ?? "gpt-5.4",
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

function buildTodoItems(prefix: string) {
  return [
    {
      id: "T01",
      title: `${prefix} scope`,
      workerType: "coding" as const,
      objective: "Lock the research scope.",
      acceptance: ["Scope is fixed"],
      status: "pending" as const,
      subtasksDir: "tasks/T01/",
    },
    {
      id: "T02",
      title: `${prefix} data`,
      workerType: "coding" as const,
      objective: "Prepare the data slice.",
      acceptance: ["Data slice exists"],
      status: "pending" as const,
      subtasksDir: "tasks/T02/",
    },
    {
      id: "T03",
      title: `${prefix} baseline`,
      workerType: "coding" as const,
      objective: "Implement the baseline.",
      acceptance: ["Baseline runs"],
      status: "pending" as const,
      subtasksDir: "tasks/T03/",
    },
    {
      id: "T04",
      title: `${prefix} evaluation`,
      workerType: "coding" as const,
      objective: "Run the evaluation.",
      acceptance: ["Metrics are recorded"],
      status: "pending" as const,
      subtasksDir: "tasks/T04/",
    },
    {
      id: "T05",
      title: `${prefix} section drafting`,
      workerType: "writing" as const,
      objective: "Draft the section-level manuscript content.",
      acceptance: ["Writing inputs are aligned"],
      status: "pending" as const,
      subtasksDir: "tasks/T05/",
    },
    {
      id: "T06",
      title: `${prefix} manuscript`,
      workerType: "writing" as const,
      objective: "Draft the manuscript sections.",
      acceptance: ["Draft exists"],
      status: "pending" as const,
      subtasksDir: "tasks/T06/",
    },
  ];
}

function buildWritingStructurePayload(
  sections: Array<{ id: string; name: string }>,
): { sections: Array<Record<string, unknown>> } {
  return {
    sections: sections.map((section) => ({
      id: section.id,
      name: section.name,
      writingGoal: `Clarify what the ${section.name} section must accomplish.`,
      keyPoints: [`Explain the scope of ${section.name}.`, `Keep ${section.name} aligned with the paper goal.`],
      questionsToAnswer: [`What should the ${section.name} section make clear to the reader?`],
      avoidPatterns: [`Do not let ${section.name} drift beyond its section boundary.`],
      requiredContext:
        section.name === "introduction" || section.name === "related-work"
          ? ["references_bib", "literature_review"]
          : section.name === "experiments" || section.name === "analysis" || section.name === "abstract"
            ? ["experiment_results"]
            : [],
    })),
  };
}

function buildSpecificationMarkdown(params: {
  problem: string;
  scope: string;
  method: string[];
  evaluation: string[];
  risks: string[];
  resources: {
    backbone: { name: string; url: string; notes: string };
    datasets: Array<{ name: string; url: string; notes: string }>;
    baselines: Array<{ name: string; url: string; notes: string }>;
  };
  execution: {
    environment: string[];
    entrypoints: Array<{ path: string; purpose: string }>;
    commands: {
      prepare: string[];
      train: string[];
      evaluate: string[];
    };
    expectedArtifacts: string[];
  };
}) {
  return [
    "# 研究规范",
    "",
    "## 问题定义",
    "",
    params.problem,
    "",
    "## 范围",
    "",
    params.scope,
    "",
    "## 方法",
    ...params.method.map((entry) => `- ${entry}`),
    "",
    "## 评估",
    ...params.evaluation.map((entry) => `- ${entry}`),
    "",
    "## 风险",
    ...params.risks.map((entry) => `- ${entry}`),
    "",
    "## 资源",
    "",
    "### Backbone",
    `- 名称：${params.resources.backbone.name}`,
    `- 地址：${params.resources.backbone.url}`,
    `- 备注：${params.resources.backbone.notes}`,
    "",
    "### 数据集",
    ...params.resources.datasets.flatMap((entry) => [
      `- 名称：${entry.name}`,
      `- 地址：${entry.url}`,
      `- 备注：${entry.notes}`,
      "",
    ]),
    "### 对比方法",
    ...params.resources.baselines.flatMap((entry) => [
      `- 名称：${entry.name}`,
      `- 地址：${entry.url}`,
      `- 备注：${entry.notes}`,
      "",
    ]),
    "## 执行说明",
    "",
    "### 环境",
    ...params.execution.environment.map((entry) => `- ${entry}`),
    "",
    "### 入口",
    ...params.execution.entrypoints.flatMap((entry) => [
      `- 路径：${entry.path}`,
      `- 用途：${entry.purpose}`,
      "",
    ]),
    "### 数据准备命令",
    ...params.execution.commands.prepare.map((entry) => `- ${entry}`),
    "",
    "### 训练命令",
    ...params.execution.commands.train.map((entry) => `- ${entry}`),
    "",
    "### 评估命令",
    ...params.execution.commands.evaluate.map((entry) => `- ${entry}`),
    "",
    "### 预期产物",
    ...params.execution.expectedArtifacts.map((entry) => `- ${entry}`),
    "",
  ].join("\n");
}

describe("researchRunCommand", () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirs.splice(0).map(async (dir) => await fs.rm(dir, { recursive: true, force: true })),
    );
    vi.restoreAllMocks();
  });

  it("wakes the main session with the fixed hook payload", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });

    await wakeMainSessionAfterResearchRun({ send });

    expect(send).toHaveBeenCalledWith(
      "wake",
      { json: false },
      { mode: "now", text: RESEARCH_RUN_WAKE_TEXT },
      { expectFinal: false, progress: false },
    );
  });

  it("wakes the main session with the fixed long-job payload", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });

    await wakeMainSessionAfterLongJob({ send });

    expect(send).toHaveBeenCalledWith(
      "wake",
      { json: false },
      {
        mode: "now",
        text: "实验已经执行完毕。请读取 AGENTS.md、当前 task 的 plan.md、summary.md、outputs/ 与必要日志，并据此进行下一步计划；本轮只选择恰好一个 next action。",
      },
      { expectFinal: false, progress: false },
    );
  });

  it("keeps the wake payload focused on root workspace files instead of worker AGENTS", () => {
    expect(RESEARCH_RUN_WAKE_TEXT).toContain(
      "Read AGENTS.md, specification.md, todo.md, layout.md",
    );
    expect(RESEARCH_RUN_WAKE_TEXT).not.toContain("agents/");
    expect(RESEARCH_RUN_WAKE_TEXT).not.toContain("agents/writing/AGENTS.md");
    expect(RESEARCH_RUN_WAKE_TEXT).not.toContain("agents/coding/AGENTS.md");
  });

  it("writes a dry-run report bundle from inline idea input", async () => {
    const root = await makeTempDir("openclaw-research-unit-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn();

    const result = await researchRunCommand(runtime, {
      idea: "agentic literature triage for NLP paper planning",
      count: 2,
      model: "openai/gpt-5.4-pro",
      thinking: "xhigh",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T08:00:00.000Z"),
      wakeMainSession,
    });

    expect(result.dryRun).toBe(true);
    expect(result.report.model).toBe("openai/gpt-5.4-pro");
    expect(result.report.sections.length).toBeGreaterThan(0);
    expect(result.report.todo.length).toBeGreaterThanOrEqual(6);
    expect(result.report.todo.length).toBeLessThanOrEqual(10);
    expect(result.report.todo.some((item) => item.workerType === "writing")).toBe(true);
    const firstWritingIndex = result.report.todo.findIndex((item) => item.workerType === "writing");
    expect(
      result.report.todo.slice(0, firstWritingIndex).every((item) => item.workerType === "coding"),
    ).toBe(true);
    expect(result.report.sectionCitations.length).toBeGreaterThan(0);
    expect(result.report.sectionExemplars.every((section) => section.papers.length === 2)).toBe(
      true,
    );
    expect(result.report.artifactCollections.references.bibPath).toBe("references.bib");
    expect(result.report.artifactCollections.exemplars.papersDirPattern).toBe(
      "section_materials/<section>/papers/",
    );

    const ideaMd = await fs.readFile(result.ideaPath, "utf-8");
    const specificationMd = await fs.readFile(result.specificationPath, "utf-8");
    const layoutMd = await fs.readFile(result.layoutPath, "utf-8");
    const literatureReviewMd = await fs.readFile(result.literatureReviewPath, "utf-8");
    const todoMd = await fs.readFile(result.todoPath, "utf-8");
    const referencesBib = await fs.readFile(result.referencesPath, "utf-8");
    const introductionCitations = await fs.readFile(
      path.join(root, "section_materials", "introduction", "citations.md"),
      "utf-8",
    );
    const introductionBrief = await fs.readFile(
      path.join(root, "section_materials", "introduction", "brief.md"),
      "utf-8",
    );
    const introductionPaperMeta = await fs.readFile(
      path.join(root, "section_materials", "introduction", "papers", "paper_01", "meta.md"),
      "utf-8",
    );
    const dispatchLog = await fs.readFile(path.join(root, "runtime", "dispatch_log.md"), "utf-8");
    const sessionNotes = await fs.readFile(path.join(root, "runtime", "session_notes.md"), "utf-8");
    const workspaceAgents = await fs.readFile(result.workspaceAgentsPath, "utf-8");
    const writingAgent = await fs.readFile(
      path.join(root, "agents", "writing", "AGENTS.md"),
      "utf-8",
    );
    const firstTaskPlan = await fs.readFile(result.taskPlanPaths[0] ?? "", "utf-8");

    expect(ideaMd).toContain("# 研究想法");
    expect(ideaMd).toContain("## 问题定义");
    expect(ideaMd).toContain("## 研究目标");
    expect(ideaMd).toContain("## 核心假设");
    expect(ideaMd).toContain("## 方法方向");
    expect(ideaMd).toContain("## 预期贡献");
    expect(specificationMd).toContain("# 研究规范");
    expect(layoutMd).toContain("# 落盘约定");
    expect(literatureReviewMd).toContain("## introduction");
    expect(todoMd).toContain("# Todo");
    expect(todoMd).toContain("task_01 — **coding** — Finalize the exact research question");
    expect(todoMd).toContain("task_05 — **writing** — Draft the main manuscript sections");
    expect(referencesBib).toContain("@inproceedings{");
    expect(referencesBib).toMatch(/^@\w+\{[^,]+,/m);
    expect(introductionCitations).toContain("# introduction 引用候选");
    expect(introductionCitations).toContain("authority_bib: ../../references.bib");
    expect(introductionCitations).toContain("style_materials: ./papers/");
    expect(introductionBrief).toContain("- writing_goal:");
    expect(introductionBrief).toContain("- references_bib: references.bib");
    expect(introductionPaperMeta).toContain("- citation_key: dryrun1");
    expect(introductionPaperMeta).toContain(
      "- short_intro: Short placeholder exemplar for style study.",
    );
    expect(dispatchLog).toContain("# Dispatch Log");
    expect(sessionNotes).toContain("# Session Notes");
    expect(workspaceAgents).toContain("你是当前 research workspace 的主会话秘书");
    expect(workspaceAgents).toContain("workspace 是唯一真源");
    expect(workspaceAgents).toContain("每一轮只能选择一个 next action");
    expect(workspaceAgents).toContain("必须显式注入当前 section 的材料合同");
    expect(writingAgent).toContain("使用 LaTeX 产出并修改目标 section");
    expect(writingAgent).toContain("一次只写一个 section");
    expect(writingAgent).toContain(
      "必须先读取 `agents/writing/AGENTS.md` 与当前 section task package",
    );
    expect(writingAgent).toContain("不允许跨 section 发散");
    expect(firstTaskPlan).toContain("## Worker Type");
    expect(firstTaskPlan).toContain("coding");
    expect(firstTaskPlan).toContain("## Step List");
    expect(firstTaskPlan).toContain("### S01");
    expect(await fs.stat(path.join(root, "agents", "coding", "AGENTS.md"))).toBeTruthy();
    expect(await fs.stat(path.join(root, "agents", "writing", "AGENTS.md"))).toBeTruthy();
    expect(await fs.stat(path.join(root, "agents", "step_planner", "AGENTS.md"))).toBeTruthy();
    expect(
      await fs.stat(path.join(root, "section_materials", "introduction", "papers")),
    ).toBeTruthy();
    await expect(fs.stat(path.join(root, "coding_agent"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.stat(path.join(root, "paper"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(wakeMainSession).not.toHaveBeenCalled();
    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining("User-provided manuscript template is missing."),
    );
  });

  it("runs the live four-stage pipeline through the Responses API", async () => {
    const root = await makeTempDir("openclaw-research-live-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);
    await createManuscriptTemplate(root);

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_idea",
              text: JSON.stringify({
                refinedIdea: "Focus on retrieval quality for research planning agents.",
                sections: [
                  {
                    id: "S01",
                    name: "introduction",
                  },
                  {
                    id: "S02",
                    name: "method",
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
              id: "resp_writing_structure",
              text: JSON.stringify(
                buildWritingStructurePayload([
                  { id: "S01", name: "introduction" },
                  { id: "S02", name: "method" },
                ]),
              ),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_spec",
              text: buildSpecificationMarkdown({
                problem: "Improve literature retrieval quality for agentic research planning.",
                scope: "One retrieval stack, one benchmark slice, one comparison baseline.",
                method: ["Build a retrieval benchmark", "Compare baseline rankers"],
                evaluation: ["Recall@k", "Human relevance audit"],
                risks: ["Evaluation data may be noisy"],
                resources: {
                  backbone: {
                    name: "MiniLM encoder",
                    url: "https://example.com/backbone",
                    notes: "Use the public encoder checkpoint as the frozen backbone.",
                  },
                  datasets: [
                    {
                      name: "ResearchBench",
                      url: "https://example.com/dataset",
                      notes: "Download the benchmark slice and keep the provided split.",
                    },
                  ],
                  baselines: [
                    {
                      name: "BM25 baseline",
                      url: "https://example.com/baseline",
                      notes: "Use the public baseline repo as the comparison reference.",
                    },
                  ],
                },
                execution: {
                  environment: ["Python 3.11", "Install dependencies from requirements.txt"],
                  entrypoints: [
                    {
                      path: "scripts/train.py",
                      purpose: "Main training entrypoint.",
                    },
                  ],
                  commands: {
                    prepare: ["python scripts/prepare.py --config configs/data.yaml"],
                    train: ["python scripts/train.py --config configs/train.yaml"],
                    evaluate: ["python scripts/eval.py --checkpoint outputs/best.ckpt"],
                  },
                  expectedArtifacts: [
                    "Prepared split json",
                    "Best checkpoint",
                    "Evaluation summary json",
                  ],
                },
              }),
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
                "@inproceedings{lewis2020rag,",
                "  title = {Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks},",
                "  author = {Patrick Lewis and Ethan Perez},",
                "  year = {2020},",
                "  booktitle = {NeurIPS},",
                "}",
                "",
                "===PAPERS===",
                "## introduction",
                "",
                "### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                "lewis2020rag",
                "",
                "Useful baseline framing reference.",
                "",
                "## method",
                "",
                "### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                "lewis2020rag",
                "",
                "Useful retrieval design baseline.",
                "",
                "===EXEMPLARS===",
                "## introduction",
                "",
                "### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                "- citation_key: lewis2020rag",
                "- pdf_url: https://arxiv.org/pdf/2005.11401",
                "- short_intro: Canonical RAG introduction exemplar.",
                "- why_relevant: Its introduction clearly motivates the task and contribution.",
                "",
                "### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                "- citation_key: lewis2020rag",
                "- pdf_url: [待核实] official NeurIPS PDF for RAG",
                "- short_intro: Alternate RAG intro framing exemplar.",
                "- why_relevant: It offers a second introduction-level rhetorical pattern.",
                "",
                "## method",
                "",
                "### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                "- citation_key: lewis2020rag",
                "- pdf_url: https://arxiv.org/pdf/2005.11401",
                "- short_intro: Canonical RAG method exemplar.",
                "- why_relevant: Its method section is directly relevant to retrieval design exposition.",
                "",
                "### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
                "- citation_key: lewis2020rag",
                "- pdf_url: [待核实] official NeurIPS PDF for RAG",
                "- short_intro: Alternate RAG method framing exemplar.",
                "- why_relevant: It provides a second method-writing pattern for the same topic.",
                "",
                "===LITERATURE_REVIEW===",
                "# Literature Review",
                "",
                "## introduction",
                "",
                "RAG is a core framing reference.",
                "",
                "## method",
                "",
                "RAG is also a method baseline.",
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
                todo: buildTodoItems("benchmark"),
              }),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(new Response("not-a-real-pdf"));

    const result = await researchRunCommand(runtime, {
      idea: "research planning agents need better literature retrieval",
      out: root,
      env: {
        OPENAI_API_KEY: "sk-test",
      },
      fetchImpl,
      now: new Date("2026-03-16T09:00:00.000Z"),
      wakeMainSession,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(result.report.stages.map((stage) => stage.responseId)).toEqual([
      "resp_idea",
      "resp_writing_structure",
      "resp_spec",
      "resp_paper",
      "resp_todo",
    ]);
    expect(result.report.refinedIdea).toContain("retrieval quality");
    expect(result.report.referencesBib).toContain("lewis2020rag");
    expect(result.report.literatureReviewMarkdown).toContain("## introduction");
    expect(result.report.sectionCitations[0]?.section).toBe("introduction");
    expect(result.report.todo[0]?.id).toBe("T01");
    expect(result.report.artifactCollections.references.citeKeys).toEqual(["lewis2020rag"]);
    expect(result.report.artifactCollections.boundaryNotes[0]).toContain(
      "同一篇论文允许同时出现在 references 与 exemplars",
    );

    const firstRequestBody = extractRequestBody(fetchImpl, 0);
    expect(firstRequestBody.model).toBe("gpt-5.4");
    const firstTools = Array.isArray(firstRequestBody.tools) ? firstRequestBody.tools : [];
    expect(firstTools.some((tool) => (tool as { type?: string }).type === "web_search")).toBe(true);

    const secondRequestBody = extractRequestBody(fetchImpl, 1);
    expect(secondRequestBody.previous_response_id).toBe("resp_idea");

    const thirdRequestBody = extractRequestBody(fetchImpl, 2);
    expect(thirdRequestBody.previous_response_id).toBe("resp_idea");

    const fifthRequestBody = extractRequestBody(fetchImpl, 4);
    expect(fifthRequestBody.previous_response_id).toBe("resp_spec");

    const specificationMd = await fs.readFile(result.specificationPath, "utf-8");
    const layoutMd = await fs.readFile(result.layoutPath, "utf-8");
    const literatureReviewMd = await fs.readFile(result.literatureReviewPath, "utf-8");
    const referencesBib = await fs.readFile(result.referencesPath, "utf-8");
    const todoMd = await fs.readFile(result.todoPath, "utf-8");
    const introductionCitations = await fs.readFile(
      path.join(root, "section_materials", "introduction", "citations.md"),
      "utf-8",
    );
    const introductionPaperMeta = await fs.readFile(
      path.join(root, "section_materials", "introduction", "papers", "paper_01", "meta.md"),
      "utf-8",
    );
    const stepPlannerAgents = await fs.readFile(result.roleAgentPaths[0] ?? "", "utf-8");

    expect(specificationMd).toContain("Improve literature retrieval quality");
    expect(layoutMd).toContain("manuscript/sections/introduction.tex");
    expect(layoutMd).toContain("- writing_goal: Clarify what the introduction section must accomplish.");
    expect(literatureReviewMd).toContain("## introduction");
    expect(referencesBib).toContain("lewis2020rag");
    expect(introductionCitations).toContain("lewis2020rag");
    expect(introductionCitations).toContain("usage_order: 先核对 references.bib，再筛选本节条目");
    expect(introductionPaperMeta).toContain("- citation_key: lewis2020rag");
    expect(introductionPaperMeta).toContain("- pdf_url: https://arxiv.org/pdf/2005.11401");
    expect(todoMd).toContain("task_01 — **coding** — benchmark scope");
    expect(todoMd).toContain("task_05 — **writing** — benchmark section drafting");
    expect(stepPlannerAgents).toContain("你是当前 research workspace 的步骤规划者");
    expect(wakeMainSession).toHaveBeenCalledWith({ json: false });
  });

  it("persists earlier stage artifacts when the paper stage fails", async () => {
    const root = await makeTempDir("openclaw-research-partial-persist-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);
    await createManuscriptTemplate(root);

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_idea",
              text: JSON.stringify({
                refinedIdea: "Focus on test-time computation for open-ended scientific discovery.",
                sections: [
                  { id: "S01", name: "introduction" },
                  { id: "S02", name: "method" },
                ],
              }),
            }),
          ),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_writing_structure",
              text: JSON.stringify(
                buildWritingStructurePayload([
                  { id: "S01", name: "introduction" },
                  { id: "S02", name: "method" },
                ]),
              ),
            }),
          ),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_spec",
              text: buildSpecificationMarkdown({
                problem: "Improve test-time computation for scientific discovery agents.",
                scope: "One benchmark family and one small set of open-ended discovery tasks.",
                method: ["Vary compute allocation", "Measure diversity and discovery quality"],
                evaluation: ["Discovery success rate", "Diversity of useful hypotheses"],
                risks: ["Search cost may dominate the budget"],
                resources: {
                  backbone: {
                    name: "GPT-5.4",
                    url: "https://example.com/backbone",
                    notes: "Use the hosted API model directly.",
                  },
                  datasets: [
                    {
                      name: "Artificial Hivemind",
                      url: "https://example.com/hivemind",
                      notes: "Use the public task set for open discovery evaluation.",
                    },
                  ],
                  baselines: [
                    {
                      name: "Self-consistency",
                      url: "https://example.com/self-consistency",
                      notes: "Use as the simple compute-time baseline.",
                    },
                  ],
                },
                execution: {
                  environment: ["Python 3.11", "Install dependencies from requirements.txt"],
                  entrypoints: [
                    {
                      path: "scripts/eval.py",
                      purpose: "Run the discovery-time evaluation loop.",
                    },
                  ],
                  commands: {
                    prepare: ["python scripts/prepare.py --config configs/data.yaml"],
                    train: ["python scripts/run_ttc.py --config configs/ttc.yaml"],
                    evaluate: ["python scripts/eval.py --config configs/eval.yaml"],
                  },
                  expectedArtifacts: ["Evaluation json", "Run logs"],
                },
              }),
            }),
          ),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: "Receive timeout from origin",
            },
          }),
          {
            status: 524,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    await expect(
      researchRunCommand(runtime, {
        idea: "better test-time computation for open-ended scientific discovery like hivemind",
        out: root,
        env: {
          OPENAI_API_KEY: "sk-test",
        },
        fetchImpl,
        responseMode: "poll",
        now: new Date("2026-03-23T08:00:00.000Z"),
        wakeMainSession,
      }),
    ).rejects.toThrow("524 Receive timeout from origin");

    await expect(fs.readFile(path.join(root, "idea.md"), "utf-8")).resolves.toContain(
      "Focus on test-time computation for open-ended scientific discovery.",
    );
    await expect(fs.readFile(path.join(root, "layout.md"), "utf-8")).resolves.toContain(
      "manuscript/sections/introduction.tex",
    );
    await expect(fs.readFile(path.join(root, "specification.md"), "utf-8")).resolves.toContain(
      "Improve test-time computation for scientific discovery agents.",
    );
    await expect(
      fs.readFile(path.join(root, "section_materials", "introduction", "brief.md"), "utf-8"),
    ).resolves.toContain("writing_goal:");
    await expect(fs.readFile(path.join(root, "references.bib"), "utf-8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.readFile(path.join(root, "todo.md"), "utf-8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(wakeMainSession).not.toHaveBeenCalled();
  });

  it("keeps literature_review.md optional when the paper stage does not emit it", async () => {
    const root = await makeTempDir("openclaw-research-no-lit-review-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);
    await createManuscriptTemplate(root);

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_idea",
              text: JSON.stringify({
                refinedIdea: "Keep literature review output optional.",
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
              text: JSON.stringify(
                buildWritingStructurePayload([{ id: "S01", name: "introduction" }]),
              ),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_spec",
              text: buildSpecificationMarkdown({
                problem: "Optional literature review output.",
                scope: "One section and one citation set.",
                method: ["Separate references from exemplar papers"],
                evaluation: ["No fallback literature_review.md is written"],
                risks: ["Model may omit the review block"],
                resources: {
                  backbone: {
                    name: "Public encoder",
                    url: "https://example.com/backbone",
                    notes: "Placeholder backbone.",
                  },
                  datasets: [
                    {
                      name: "OptionalReviewBench",
                      url: "https://example.com/dataset",
                      notes: "Placeholder dataset.",
                    },
                  ],
                  baselines: [
                    {
                      name: "Optional review baseline",
                      url: "https://example.com/baseline",
                      notes: "Placeholder baseline.",
                    },
                  ],
                },
                execution: {
                  environment: ["Node.js"],
                  entrypoints: [{ path: "src/index.ts", purpose: "Placeholder." }],
                  commands: {
                    prepare: ["pnpm prepare"],
                    train: ["pnpm train"],
                    evaluate: ["pnpm eval"],
                  },
                  expectedArtifacts: ["references.bib", "citations.md"],
                },
              }),
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
                "@article{optional2026,",
                "  title = {Optional Literature Review},",
                "  author = {OpenClaw},",
                "  year = {2026},",
                "}",
                "",
                "===PAPERS===",
                "## introduction",
                "",
                "### Optional Literature Review",
                "optional2026",
                "",
                "Supports the introduction section.",
                "",
                "===EXEMPLARS===",
                "## introduction",
                "",
                "### Optional Literature Review",
                "- citation_key: optional2026",
                "- pdf_url: [待核实] optional review pdf",
                "- short_intro: Short optional-review exemplar.",
                "- why_relevant: It offers a clean introduction structure.",
                "",
                "### Optional Literature Review",
                "- citation_key: optional2026",
                "- pdf_url: https://example.com/optional.pdf",
                "- short_intro: Second optional-review exemplar.",
                "- why_relevant: It provides an alternative introduction cadence.",
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
                todo: buildTodoItems("optional"),
              }),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(new Response("not-a-real-pdf"));

    const result = await researchRunCommand(runtime, {
      idea: "make literature_review optional",
      out: root,
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl,
      wakeMainSession,
    });

    expect(result.report.literatureReviewMarkdown).toBeUndefined();
    expect(result.report.artifactCollections.references.literatureReviewPath).toBeUndefined();
    await expect(fs.stat(path.join(root, "literature_review.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      fs.readFile(path.join(root, "section_materials", "introduction", "citations.md"), "utf-8"),
    ).resolves.toContain("- cite_key: optional2026");
  });

  it("migrates legacy root artifacts before running live stages", async () => {
    const root = await makeTempDir("openclaw-research-migrate-");
    createdDirs.push(root);
    await fs.mkdir(path.join(root, "specification"), { recursive: true });
    await fs.mkdir(path.join(root, "paper"), { recursive: true });
    await fs.writeFile(path.join(root, "specification", "idea.md"), "# legacy idea\n", "utf-8");
    await fs.writeFile(
      path.join(root, "specification", "specification.md"),
      "# legacy spec\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(root, "paper", "references.bib"),
      "@article{legacy,\n}\n",
      "utf-8",
    );
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("stop after migration"));

    await expect(
      researchRunCommand(runtime, {
        idea: "force migration before live execution",
        out: root,
        env: { OPENAI_API_KEY: "sk-test" },
        fetchImpl,
      }),
    ).rejects.toThrow("stop after migration");

    await expect(fs.readFile(path.join(root, "idea.md"), "utf-8")).resolves.toContain(
      "legacy idea",
    );
    await expect(fs.readFile(path.join(root, "specification.md"), "utf-8")).resolves.toContain(
      "legacy spec",
    );
    await expect(fs.readFile(path.join(root, "references.bib"), "utf-8")).resolves.toContain(
      "@article{legacy",
    );
  });

  it("aligns section citation files to layout slugs", async () => {
    const root = await makeTempDir("openclaw-research-layout-slug-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);
    await createManuscriptTemplate(root);

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_idea",
              text: JSON.stringify({
                refinedIdea: "Keep section slugs stable across layout and literature outputs.",
                sections: [
                  { id: "S01", name: "introduction" },
                  { id: "S02", name: "related-work" },
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
              id: "resp_writing_structure",
              text: JSON.stringify(
                buildWritingStructurePayload([
                  { id: "S01", name: "introduction" },
                  { id: "S02", name: "related-work" },
                ]),
              ),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_spec",
              text: buildSpecificationMarkdown({
                problem: "Keep slug alignment stable.",
                scope: "One layout and one literature output.",
                method: ["Render layout from idea sections"],
                evaluation: ["Section files are aligned"],
                risks: ["Model returns inconsistent slugs"],
                resources: {
                  backbone: {
                    name: "Public encoder",
                    url: "https://example.com/backbone",
                    notes: "Placeholder backbone.",
                  },
                  datasets: [
                    {
                      name: "SlugBench",
                      url: "https://example.com/dataset",
                      notes: "Placeholder dataset.",
                    },
                  ],
                  baselines: [
                    {
                      name: "Slug baseline",
                      url: "https://example.com/baseline",
                      notes: "Placeholder baseline.",
                    },
                  ],
                },
                execution: {
                  environment: ["Node.js"],
                  entrypoints: [{ path: "src/index.ts", purpose: "Placeholder." }],
                  commands: {
                    prepare: ["pnpm prepare"],
                    train: ["pnpm train"],
                    evaluate: ["pnpm eval"],
                  },
                  expectedArtifacts: ["layout.md", "citations.md"],
                },
              }),
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
                "@article{slug2026,",
                "  title = {Slug Alignment},",
                "  author = {OpenClaw},",
                "  year = {2026},",
                "}",
                "",
                "===PAPERS===",
                "## introduction",
                "",
                "### Slug Alignment",
                "slug2026",
                "",
                "Introduction note.",
                "",
                "## related_work",
                "",
                "### Slug Alignment",
                "slug2026",
                "",
                "Related-work note.",
                "",
                "===EXEMPLARS===",
                "## introduction",
                "",
                "### Slug Alignment",
                "- citation_key: slug2026",
                "- pdf_url: https://example.com/slug-intro.pdf",
                "- short_intro: Short introduction slug exemplar.",
                "- why_relevant: It anchors the introduction naming path.",
                "",
                "### Slug Alignment",
                "- citation_key: slug2026",
                "- pdf_url: [待核实] slug intro pdf",
                "- short_intro: Second introduction slug exemplar.",
                "- why_relevant: It keeps the alternate intro source in the same slug family.",
                "",
                "## related_work",
                "",
                "### Slug Alignment",
                "- citation_key: slug2026",
                "- pdf_url: https://example.com/slug-related.pdf",
                "- short_intro: Short related-work slug exemplar.",
                "- why_relevant: It demonstrates related-work organization.",
                "",
                "### Slug Alignment",
                "- citation_key: slug2026",
                "- pdf_url: [待核实] slug related pdf",
                "- short_intro: Second related-work slug exemplar.",
                "- why_relevant: It provides a complementary review-style structure.",
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
                todo: buildTodoItems("slug"),
              }),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(new Response("not-a-real-pdf"))
      .mockResolvedValueOnce(new Response("not-a-real-pdf"));

    await researchRunCommand(runtime, {
      idea: "align layout and citations",
      out: root,
      env: { OPENAI_API_KEY: "sk-test" },
      fetchImpl,
      wakeMainSession,
    });

    await expect(
      fs.readFile(path.join(root, "section_materials", "related-work", "citations.md"), "utf-8"),
    ).resolves.toContain("slug2026");
    await expect(
      fs.stat(path.join(root, "section_materials", "related_work")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("uses explicit context on non-official base URLs and skips tool_search", async () => {
    const root = await makeTempDir("openclaw-research-proxy-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);
    await createManuscriptTemplate(root);

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_idea",
              text: JSON.stringify({
                refinedIdea: "Use explicit context carry-over for proxy-backed research pipelines.",
                sections: [
                  {
                    id: "S01",
                    name: "introduction",
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
              id: "resp_writing_structure",
              text: JSON.stringify(
                buildWritingStructurePayload([{ id: "S01", name: "introduction" }]),
              ),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_spec",
              text: buildSpecificationMarkdown({
                problem: "Proxy-compatible staged research generation.",
                scope: "One workflow and one proxy provider.",
                method: ["Carry explicit context across stages"],
                evaluation: ["Successful four-stage execution"],
                risks: ["Prompt size can grow"],
                resources: {
                  backbone: {
                    name: "Public encoder",
                    url: "https://example.com/proxy-backbone",
                    notes: "Frozen backbone for proxy compatibility tests.",
                  },
                  datasets: [
                    {
                      name: "ProxyBench",
                      url: "https://example.com/proxy-dataset",
                      notes: "Tiny dataset slice used for proxy-backed integration tests.",
                    },
                  ],
                  baselines: [
                    {
                      name: "Static retrieval",
                      url: "https://example.com/proxy-baseline",
                      notes: "Reference baseline for proxy-backed runs.",
                    },
                  ],
                },
                execution: {
                  environment: ["Python 3.11"],
                  entrypoints: [
                    {
                      path: "scripts/run_proxy.py",
                      purpose: "Proxy-backed experiment entrypoint.",
                    },
                  ],
                  commands: {
                    prepare: ["python scripts/prepare_proxy.py"],
                    train: ["python scripts/run_proxy.py --mode train"],
                    evaluate: ["python scripts/run_proxy.py --mode eval"],
                  },
                  expectedArtifacts: [
                    "Prepared proxy slice",
                    "Proxy run log",
                    "Proxy evaluation summary",
                  ],
                },
              }),
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
                "@inproceedings{proxy2026,",
                "  title = {Proxy-Compatible Responses API Workflows},",
                "  author = {OpenClaw Research},",
                "  year = {2026},",
                "  booktitle = {Systems Notes},",
                "}",
                "",
                "===PAPERS===",
                "## introduction",
                "",
                "### Proxy-Compatible Responses API Workflows",
                "proxy2026",
                "",
                "Describes explicit context fallback for staged pipelines.",
                "",
                "===EXEMPLARS===",
                "## introduction",
                "",
                "### Proxy-Compatible Responses API Workflows",
                "- citation_key: proxy2026",
                "- pdf_url: https://example.com/proxy.pdf",
                "- short_intro: Short proxy workflow exemplar.",
                "- why_relevant: It has a clean systems-paper introduction.",
                "",
                "### Proxy-Compatible Responses API Workflows",
                "- citation_key: proxy2026",
                "- pdf_url: [待核实] proxy workflow venue pdf",
                "- short_intro: Second proxy workflow exemplar.",
                "- why_relevant: It provides a second concise introduction shape.",
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
                todo: buildTodoItems("proxy"),
              }),
            }),
          ),
        ),
      )
      .mockResolvedValueOnce(new Response("not-a-real-pdf"));

    await researchRunCommand(runtime, {
      idea: "make staged research generation work on a proxy",
      out: root,
      baseUrl: "https://proxy.example.com/v1",
      env: {
        OPENAI_API_KEY: "sk-test",
        OPENAI_RESEARCH_SKILLS: "browser,latex",
        OPENAI_RESEARCH_VECTOR_STORE_IDS: "vs_proxy",
        OPENAI_RESEARCH_MCP_SERVER_URL: "https://mcp.example.com",
        OPENAI_RESEARCH_COMPUTER_ENVIRONMENT: "browser",
      },
      fetchImpl,
      now: new Date("2026-03-16T09:15:00.000Z"),
      wakeMainSession,
    });

    const firstRequestBody = extractRequestBody(fetchImpl, 0);
    const firstTools = Array.isArray(firstRequestBody.tools) ? firstRequestBody.tools : [];
    expect(firstTools.map((tool) => (tool as { type?: string }).type)).toEqual([
      "web_search",
      "image_generation",
      "code_interpreter",
      "shell",
      "apply_patch",
    ]);
    const shellTool = firstTools.find((tool) => (tool as { type?: string }).type === "shell") as
      | { type?: string; environment?: { type?: string } }
      | undefined;
    expect(shellTool?.environment).toBeUndefined();

    const secondRequestBody = extractRequestBody(fetchImpl, 1);
    expect(secondRequestBody.previous_response_id).toBeUndefined();
    expect(String(secondRequestBody.input)).toContain("refined idea");
    expect(String(secondRequestBody.input)).toContain("第 2 阶段：writing structure");

    const thirdRequestBody = extractRequestBody(fetchImpl, 2);
    expect(thirdRequestBody.previous_response_id).toBeUndefined();
    expect(String(thirdRequestBody.input)).toContain("第 3 阶段：specification");
    expect(String(thirdRequestBody.input)).toContain("sections(JSON)");

    const fourthRequestBody = extractRequestBody(fetchImpl, 3);
    expect(fourthRequestBody.previous_response_id).toBeUndefined();
    expect(String(fourthRequestBody.input)).toContain("第 4 阶段：paper references");
    expect(String(fourthRequestBody.input)).toContain("idea.md");
    expect(String(fourthRequestBody.input)).toContain("layout.md");
    expect(String(fourthRequestBody.input)).toContain("introduction");
    const fourthTools = Array.isArray(fourthRequestBody.tools) ? fourthRequestBody.tools : [];
    expect(fourthTools.map((tool) => (tool as { type?: string }).type)).toEqual(["web_search"]);

    const fifthRequestBody = extractRequestBody(fetchImpl, 4);
    expect(fifthRequestBody.previous_response_id).toBeUndefined();
    expect(String(fifthRequestBody.input)).toContain("specification(markdown)");
    expect(String(fifthRequestBody.input)).toContain("idea.md");
    expect(String(fifthRequestBody.input)).not.toContain("layout.md");
    expect(String(fifthRequestBody.input)).not.toContain("references.bib");
    expect(String(fifthRequestBody.input)).not.toContain("section_materials/");
    expect(wakeMainSession).toHaveBeenCalledWith({ json: false });
  });

  it("retries with explicit context when previous_response_id is rejected", async () => {
    const root = await makeTempDir("openclaw-research-retry-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);
    await createManuscriptTemplate(root);

    let specFailedOnce = false;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (!init || typeof init.body !== "string") {
        return new Response("not-a-real-pdf");
      }
      const body = JSON.parse(String(init?.body)) as {
        input?: string;
        previous_response_id?: string;
      };
      const input = String(body.input ?? "");
      if (input.includes("第 1 阶段：idea refinement")) {
        return new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_idea",
              text: JSON.stringify({
                refinedIdea: "Retry with explicit context when chaining is unavailable.",
                sections: [{ id: "S01", name: "analysis" }],
              }),
            }),
          ),
        );
      }
      if (input.includes("第 2 阶段：writing structure")) {
        return new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_writing_structure",
              text: JSON.stringify(
                buildWritingStructurePayload([{ id: "S01", name: "analysis" }]),
              ),
            }),
          ),
        );
      }
      if (input.includes("第 3 阶段：specification")) {
        if (body.previous_response_id === "resp_idea" && !specFailedOnce) {
          specFailedOnce = true;
          return new Response(
            JSON.stringify({
              error: {
                message: "Previous response with id 'resp_idea' not found.",
                code: "previous_response_not_found",
                param: "previous_response_id",
              },
            }),
            { status: 400 },
          );
        }
        return new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_spec",
              text: buildSpecificationMarkdown({
                problem: "Response chaining is unavailable on the proxy.",
                scope: "Fallback only when chaining fails.",
                method: ["Retry with explicit upstream context"],
                evaluation: ["Stage completes after retry"],
                risks: ["Prompt duplication"],
                resources: {
                  backbone: {
                    name: "Public encoder",
                    url: "https://example.com/retry-backbone",
                    notes: "Reference encoder for retry fallback tests.",
                  },
                  datasets: [
                    {
                      name: "RetryBench",
                      url: "https://example.com/retry-dataset",
                      notes: "Small slice for retry fallback validation.",
                    },
                  ],
                  baselines: [
                    {
                      name: "Chain-only baseline",
                      url: "https://example.com/retry-baseline",
                      notes: "Reference implementation that fails without fallback.",
                    },
                  ],
                },
                execution: {
                  environment: ["Python 3.11"],
                  entrypoints: [
                    {
                      path: "scripts/retry.py",
                      purpose: "Retry fallback experiment entrypoint.",
                    },
                  ],
                  commands: {
                    prepare: ["python scripts/prepare_retry.py"],
                    train: ["python scripts/retry.py --mode train"],
                    evaluate: ["python scripts/retry.py --mode eval"],
                  },
                  expectedArtifacts: [
                    "Prepared retry split",
                    "Retry run log",
                    "Retry evaluation summary",
                  ],
                },
              }),
            }),
          ),
        );
      }
      if (input.includes("第 4 阶段：paper references")) {
        return new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_paper",
              text: [
                "===BIB===",
                "@inproceedings{retry2026,",
                "  title = {Fallback Retries for Response Chaining Failures},",
                "  author = {OpenClaw Research},",
                "  year = {2026},",
                "  booktitle = {Systems Notes},",
                "}",
                "",
                "===PAPERS===",
                "## analysis",
                "",
                "### Fallback Retries for Response Chaining Failures",
                "retry2026",
                "",
                "Documents retrying with explicit context after chain failures.",
                "",
                "===EXEMPLARS===",
                "## analysis",
                "",
                "### Fallback Retries for Response Chaining Failures",
                "- citation_key: retry2026",
                "- pdf_url: https://example.com/retry.pdf",
                "- short_intro: Short retry analysis exemplar.",
                "- why_relevant: It demonstrates concise failure-analysis structure.",
                "",
                "### Fallback Retries for Response Chaining Failures",
                "- citation_key: retry2026",
                "- pdf_url: [待核实] retry systems note pdf",
                "- short_intro: Second retry analysis exemplar.",
                "- why_relevant: It offers an alternate analysis-section cadence.",
              ].join("\n"),
            }),
          ),
        );
      }
      if (input.includes("第 5 阶段：top-level todo")) {
        return new Response(
          JSON.stringify(
            buildResponsesJson({
              id: "resp_todo",
              text: JSON.stringify({
                todo: buildTodoItems("retry"),
              }),
            }),
          ),
        );
      }
      throw new Error(`Unexpected request body: ${input}`);
    });

    await researchRunCommand(runtime, {
      idea: "retry explicit context after previous_response_id failure",
      out: root,
      env: {
        OPENAI_API_KEY: "sk-test",
      },
      fetchImpl,
      now: new Date("2026-03-16T09:20:00.000Z"),
      wakeMainSession,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(7);

    const requestBodies = fetchImpl.mock.calls
      .slice(0, 6)
      .map((_, index) => extractRequestBody(fetchImpl, index));
    const failedSpecRequestBody = requestBodies.find(
      (body) =>
        body.previous_response_id === "resp_idea" &&
        String(body.input).includes("第 3 阶段：specification"),
    );
    expect(failedSpecRequestBody).toBeTruthy();

    const retriedSpecRequestBody = requestBodies.find(
      (body) =>
        body.previous_response_id === undefined &&
        String(body.input).includes("第 3 阶段：specification") &&
        String(body.input).includes("当前 API 不可靠地支持 previous_response_id"),
    );
    expect(retriedSpecRequestBody).toBeTruthy();

    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining("retrying with explicit context"),
    );
    expect(wakeMainSession).toHaveBeenCalledWith({ json: false });
  });

  it("dispatches coding_agent directly when plan.md is already executable", async () => {
    const root = await makeTempDir("openclaw-research-tick-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await researchRunCommand(runtime, {
      idea: "agentic literature triage for NLP paper planning",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T08:00:00.000Z"),
    });

    const codingRunner = vi.fn().mockImplementation(async ({ workspaceDir, taskId }) => {
      const taskPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
      await fs.writeFile(
        taskPath,
        [
          `# ${taskId} Finalize the exact research question`,
          "",
          "## Worker Type",
          "coding",
          "",
          "## 状态",
          "done",
          "",
          "## 目标",
          "锁定研究问题、基线和边界。",
          "",
          "## 验收标准",
          "- Question statement is fixed",
          "- Baseline is named",
          "",
          "## Step List",
          "",
          "### S01",
          "- status: done",
          "- task: 整理一版研究问题表述",
          "- acceptance: 研究问题表述已写清楚",
          "",
          "### S02",
          "- status: done",
          "- task: 明确 baseline 和 out-of-scope",
          "- acceptance: baseline 与边界已确认",
          "",
          "## Blockers",
          "- 暂无",
          "",
          "## 最近执行结果",
          "- Coding Agent 已完成当前子任务。",
          "",
          "## Next Action Hint",
          "- 转到下一个顶层任务。",
          "",
        ].join("\n"),
        "utf-8",
      );
      await writeCodingTaskOutputs(workspaceDir, taskId, {
        status: "done",
        summary: "代码执行者完成了当前任务的首轮执行。",
        logLine: "[done] 完成首轮执行",
      });
      return {
        status: "done",
        summary: "代码执行者完成了当前任务的首轮执行。",
        updated_files: [
          "tasks/T01/plan.md",
          "tasks/T01/summary.md",
          "tasks/T01/outputs/result.json",
          "tasks/T01/logs/run.log",
        ],
        needs_replan: false,
        needs_long_job: false,
        long_job_request: "",
        artifacts: ["tasks/T01/artifacts/question.md"],
        rawStdout: [
          "RESULT: done",
          "SUMMARY: 完成首轮执行",
          "PLAN_UPDATE: 已把当前任务状态写回 plan.md。",
          "NEXT_HINT: 转到下一个顶层任务。",
        ].join("\n"),
        rawStderr: "",
        exitCode: 0,
        stdoutBrief: {
          result: "done",
          summary: "完成首轮执行",
          planUpdate: "已把当前任务状态写回 plan.md。",
          nextHint: "转到下一个顶层任务。",
        },
      };
    });

    const firstTick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: codingRunner,
      now: new Date("2026-03-16T08:05:00.000Z"),
    });

    expect(firstTick.action).toBe("dispatched_coding_agent");
    expect(firstTick.dispatchedRole).toBe("coding_agent");
    expect(firstTick.activeTaskId).toBe("T02");

    const todoMd = await fs.readFile(path.join(root, "todo.md"), "utf-8");
    const state = await readJson<{ activeTaskId?: string; lastRole?: string }>(
      path.join(root, "state.json"),
    );
    const taskMd = await fs.readFile(path.join(root, "tasks", "T01", "plan.md"), "utf-8");

    expect(todoMd).toContain("- [x] task_01 — **coding** — Finalize the exact research question");
    expect(state.activeTaskId).toBe("T02");
    expect(state.lastRole).toBe("coding_agent");
    expect(taskMd).toContain("- status: done");
    expect(firstTick.roleResult?.rawStdout).toContain("RESULT: done");
    expect(firstTick.roleResult?.rawStderr).toBe("");
    expect(firstTick.roleResult?.exitCode).toBe(0);
  });

  it("dispatches step_planner when the active todo item has no plan.md yet", async () => {
    const root = await makeTempDir("openclaw-research-missing-plan-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await researchRunCommand(runtime, {
      idea: "workspace-driven research dispatch without an initial task plan",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T10:00:00.000Z"),
    });

    await fs.rm(path.join(root, "tasks", "T01", "plan.md"));

    const runner = vi.fn().mockImplementation(async ({ workspaceDir, taskId, role }) => {
      expect(role).toBe("step_planner");
      const taskPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
      await fs.writeFile(
        taskPath,
        [
          "# T01 Finalize the exact research question",
          "",
          "## Worker Type",
          "coding",
          "",
          "## 状态",
          "pending",
          "",
          "## 目标",
          "锁定研究问题、基线和边界。",
          "",
          "## 验收标准",
          "- Question statement is fixed",
          "",
          "## Step List",
          "",
          "### S01",
          "- status: pending",
          "- task: 整理研究问题和 baseline 边界",
          "- acceptance: 当前任务具备可执行的首个 coding 步骤",
          "",
          "## Blockers",
          "- 暂无",
          "",
          "## 最近执行结果",
          "- Step Planner 已补齐缺失的计划文件。",
          "",
          "## Next Action Hint",
          "- 进入 coding 执行。",
          "",
        ].join("\n"),
        "utf-8",
      );
      return buildPlannerRoleResult("缺失 plan.md，已补齐。");
    });

    const tick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: runner,
      now: new Date("2026-03-16T10:01:00.000Z"),
    });

    expect(tick.action).toBe("dispatched_step_planner");
    expect(tick.dispatchedRole).toBe("step_planner");
    expect(runner).toHaveBeenCalledOnce();
    await expect(
      fs.readFile(path.join(root, "tasks", "T01", "plan.md"), "utf-8"),
    ).resolves.toContain("### S01");
  });

  it("returns to step_planner when the current plan has blockers", async () => {
    const root = await makeTempDir("openclaw-research-blocked-plan-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await researchRunCommand(runtime, {
      idea: "workspace-driven replanning after blockers",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T10:10:00.000Z"),
    });

    await fs.writeFile(
      path.join(root, "tasks", "T01", "plan.md"),
      [
        "# T01 Finalize the exact research question",
        "",
        "## Worker Type",
        "coding",
        "",
        "## 状态",
        "in_progress",
        "",
        "## 目标",
        "锁定研究问题、基线和边界。",
        "",
        "## 验收标准",
        "- Question statement is fixed",
        "",
        "## Step List",
        "",
        "### S01",
        "- status: pending",
        "- task: 等待外部数据路径确认",
        "- acceptance: 数据路径已经明确",
        "",
        "## Blockers",
        "- 缺少数据目录，当前步骤无法继续。",
        "",
        "## 最近执行结果",
        "- 当前步骤被外部依赖阻塞。",
        "",
        "## Next Action Hint",
        "- 回到 Step Planner 调整路径。",
        "",
      ].join("\n"),
      "utf-8",
    );

    const runner = vi.fn().mockImplementation(async ({ role }) => {
      expect(role).toBe("step_planner");
      return buildPlannerRoleResult("blocker 已识别，已请求重新规划。");
    });

    const tick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: runner,
      now: new Date("2026-03-16T10:11:00.000Z"),
    });

    expect(tick.action).toBe("dispatched_step_planner");
    expect(tick.dispatchedRole).toBe("step_planner");
    expect(runner).toHaveBeenCalledOnce();
  });

  it("blocks writing until every top-level coding task is actually done in workspace", async () => {
    const root = await makeTempDir("openclaw-research-writing-gate-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await createManuscriptTemplate(root);
    await researchRunCommand(runtime, {
      idea: "writing should wait for coding completion",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T10:20:00.000Z"),
    });

    const todoPath = path.join(root, "todo.md");
    const todoMarkdown = await fs.readFile(todoPath, "utf-8");
    await fs.writeFile(
      todoPath,
      todoMarkdown.replace(
        "- [ ] task_01 — **coding** — Finalize the exact research question (`tasks/T01/`)",
        "- [x] task_01 — **coding** — Finalize the exact research question (`tasks/T01/`)",
      ),
      "utf-8",
    );

    const runner = vi.fn().mockImplementation(async ({ role, taskId }) => {
      expect(role).toBe("coding_agent");
      expect(taskId).toBe("T01");
      const taskPath = path.join(root, "tasks", taskId, "plan.md");
      const current = await fs.readFile(taskPath, "utf-8");
      await fs.writeFile(
        taskPath,
        current
          .replace(/\n## 状态\n(?:pending|in_progress)\n/, "\n## 状态\ndone\n")
          .replace("- status: pending", "- status: done")
          .replace(
            "\n## 最近执行结果\n\n- 暂无\n",
            "\n## 最近执行结果\n\n- Coding Agent 已完成当前步骤。\n",
          )
          .replace(
            "\n## Next Action Hint\n\n- 从 S01 开始，先完成第一个可验证步骤并同步更新状态。\n",
            "\n## Next Action Hint\n\n- 转到下一个顶层任务。\n",
          ),
        "utf-8",
      );
      await writeCodingTaskOutputs(root, taskId, {
        status: "done",
        summary: "此断言只验证进入的不是 writing。",
        logLine: "[done] 当前顶层 coding 已完成",
      });
      return {
        status: "done" as const,
        summary: "此断言只验证进入的不是 writing。",
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
          "SUMMARY: 此断言只验证进入的不是 writing",
          "PLAN_UPDATE: 已把当前 plan 写回 workspace。",
          "NEXT_HINT: 转到下一个顶层任务。",
        ].join("\n"),
        rawStderr: "",
        exitCode: 0,
        stdoutBrief: {
          result: "done" as const,
          summary: "此断言只验证进入的不是 writing",
          planUpdate: "已把当前 plan 写回 workspace。",
          nextHint: "转到下一个顶层任务。",
        },
      };
    });

    const tick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: runner,
      now: new Date("2026-03-16T10:21:00.000Z"),
    });

    expect(tick.dispatchedRole).toBe("coding_agent");
    expect(runner).toHaveBeenCalledOnce();
  });

  it("dispatches writing_agent when coding is finished and section materials are complete", async () => {
    const root = await makeTempDir("openclaw-research-writing-ready-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await createManuscriptTemplate(root);
    await researchRunCommand(runtime, {
      idea: "writing dispatch after coding completion",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T10:30:00.000Z"),
    });

    await markDryRunCodingTasksDone(root);
    await prepareIntroductionWritingMaterials(root);

    const runner = vi.fn().mockImplementation(async ({ role, taskId, workspaceDir }) => {
      expect(role).toBe("writing_agent");
      expect(taskId).toBe("T05");
      const writingPackage = await fs.readFile(
        path.join(workspaceDir, "tasks", "T05", "writing_packages", "W01.md"),
        "utf-8",
      );
      expect(writingPackage).toContain("- section_id: S01");
      expect(writingPackage).toContain("- output_tex_path: manuscript/sections/introduction.tex");
      expect(writingPackage).toContain("- result_json_paths: none");
      expect(writingPackage).toContain("- citation_keys: dryrun1, dryrun2");
      const taskPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
      const current = await fs.readFile(taskPath, "utf-8");
      await fs.writeFile(
        taskPath,
        current
          .replace("### W01\n- status: pending", "### W01\n- status: done")
          .replace(
            "- 从 W01 开始，先核对首节的 brief、citations 与 manuscript 路径。",
            "- 继续推进 W02。",
          )
          .replace(
            "\n## 最近执行结果\n\n- 暂无\n",
            "\n## 最近执行结果\n\n- Writing Agent 已完成首个 section。\n",
          ),
        "utf-8",
      );
      await writeWritingSectionOutput(
        workspaceDir,
        "introduction",
        "\\section{Introduction}\nWe follow prior work \\cite{dryrun1,dryrun2}.\n",
      );
      return {
        status: "done" as const,
        summary: "写作执行者已完成当前 section。",
        updated_files: ["tasks/T05/plan.md", "manuscript/sections/introduction.tex"],
        needs_replan: false,
        needs_long_job: false,
        long_job_request: "",
        artifacts: ["manuscript/sections/introduction.tex"],
        rawStdout: [
          "RESULT: done",
          "SUMMARY: 写作执行者已完成当前 section",
          "PLAN_UPDATE: 已把 W01 标记为 done。",
          "NEXT_HINT: 继续下一个 queue item。",
        ].join("\n"),
        rawStderr: "",
        exitCode: 0,
        stdoutBrief: {
          result: "done" as const,
          summary: "写作执行者已完成当前 section",
          planUpdate: "已把 W01 标记为 done。",
          nextHint: "继续下一个 queue item。",
        },
      };
    });

    const tick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: runner,
      now: new Date("2026-03-16T10:31:00.000Z"),
    });
    const tex = await fs.readFile(
      path.join(root, "manuscript", "sections", "introduction.tex"),
      "utf-8",
    );

    expect(tick.action).toBe("dispatched_writing_agent");
    expect(tick.dispatchedRole).toBe("writing_agent");
    expect(runner).toHaveBeenCalledOnce();
    expect(tex).toContain("\\cite{dryrun1,dryrun2}");
  });

  it("rejects markdown-like section output during LaTeX sanity check", async () => {
    const root = await makeTempDir("openclaw-research-writing-sanity-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await createManuscriptTemplate(root);
    await researchRunCommand(runtime, {
      idea: "writing tex sanity should reject markdown output",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T10:35:00.000Z"),
    });

    await markDryRunCodingTasksDone(root);
    await prepareIntroductionWritingMaterials(root);

    const runner = vi.fn().mockImplementation(async ({ workspaceDir, taskId }) => {
      const taskPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
      const current = await fs.readFile(taskPath, "utf-8");
      await fs.writeFile(
        taskPath,
        current
          .replace("### W01\n- status: pending", "### W01\n- status: done")
          .replace(
            "\n## 最近执行结果\n\n- 暂无\n",
            "\n## 最近执行结果\n\n- Writing Agent 错误写出了 Markdown。\n",
          ),
        "utf-8",
      );
      await writeWritingSectionOutput(
        root,
        "introduction",
        "# Introduction\n\nThis is markdown.\n",
      );
      return {
        status: "done" as const,
        summary: "错误写出了 markdown。",
        updated_files: ["tasks/T05/plan.md", "manuscript/sections/introduction.tex"],
        needs_replan: false,
        needs_long_job: false,
        long_job_request: "",
        artifacts: ["manuscript/sections/introduction.tex"],
        rawStdout: [
          "RESULT: done",
          "SUMMARY: 错误写出了 markdown",
          "PLAN_UPDATE: 已把 W01 标记为 done。",
          "NEXT_HINT: 不应通过 sanity check。",
        ].join("\n"),
        rawStderr: "",
        exitCode: 0,
        stdoutBrief: {
          result: "done" as const,
          summary: "错误写出了 markdown",
          planUpdate: "已把 W01 标记为 done。",
          nextHint: "不应通过 sanity check。",
        },
      };
    });

    await expect(
      researchTickCommand(runtime, {
        workspace: root,
        roleRunner: runner,
        now: new Date("2026-03-16T10:36:00.000Z"),
      }),
    ).rejects.toThrow("看起来仍是 Markdown 标题");
  });

  it("refuses writing when the selected source section markdown is missing", async () => {
    const root = await makeTempDir("openclaw-research-writing-missing-material-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await createManuscriptTemplate(root);
    await researchRunCommand(runtime, {
      idea: "writing should stop when source sections are missing",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T10:40:00.000Z"),
    });

    await markDryRunCodingTasksDone(root);
    await prepareIntroductionWritingMaterials(root);
    const sourceSectionsDir = path.join(
      root,
      "section_materials",
      "introduction",
      "papers",
      "paper_01",
      "source_sections",
    );
    const [firstSourceSection] = (await fs.readdir(sourceSectionsDir)).filter((file) =>
      file.endsWith(".md"),
    );
    await fs.rm(path.join(sourceSectionsDir, firstSourceSection));

    const runner = vi.fn().mockImplementation(async ({ role }) => {
      expect(role).toBe("step_planner");
      return buildPlannerRoleResult("写作材料缺失，已退回规划。");
    });

    const tick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: runner,
      now: new Date("2026-03-16T10:41:00.000Z"),
    });

    expect(tick.action).toBe("dispatched_step_planner");
    expect(tick.dispatchedRole).toBe("step_planner");
    expect(runner).toHaveBeenCalledOnce();
  });

  it("launches a prepared long job and hands it off to the supervisor", async () => {
    const root = await makeTempDir("openclaw-research-long-job-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await researchRunCommand(runtime, {
      idea: "agentic literature triage for NLP paper planning",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T08:00:00.000Z"),
    });

    await fs.writeFile(
      path.join(root, "tasks", "T01", "plan.md"),
      [
        "# T01 Finalize the exact research question",
        "",
        "## Worker Type",
        "coding",
        "",
        "## 状态",
        "in_progress",
        "",
        "## 目标",
        "锁定研究问题、基线和边界。",
        "",
        "## 验收标准",
        "- Question statement is fixed",
        "",
        "## Step List",
        "",
        "### S01",
        "- status: pending",
        "- task: 跑一轮小规模实验判断是否值得长训练",
        "- acceptance: 小规模实验结果已记录",
        "",
        "## Blockers",
        "- 暂无",
        "",
        "## 最近执行结果",
        "- 暂无",
        "",
        "## Next Action Hint",
        "- 先执行 S01。",
        "",
      ].join("\n"),
      "utf-8",
    );

    const runner = vi.fn().mockImplementation(async ({ workspaceDir, taskId }) => {
      const taskPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
      await fs.writeFile(
        taskPath,
        [
          "# T01 Finalize the exact research question",
          "",
          "## Worker Type",
          "coding",
          "",
          "## 状态",
          "in_progress",
          "",
          "## 目标",
          "锁定研究问题、基线和边界。",
          "",
          "## 验收标准",
          "- Question statement is fixed",
          "",
          "## Step List",
          "",
          "### S01",
          "- status: done",
          "- task: 跑一轮小规模实验判断是否值得长训练",
          "- acceptance: 小规模实验结果已记录",
          "",
          "### S02",
          "- status: pending",
          "- task: 等待后台长训练结束并回读结果",
          "- acceptance: 后台长训练结果已落盘",
          "",
          "## Blockers",
          "- 暂无",
          "",
          "## 最近执行结果",
          "- 已完成长训练前的小规模验证，并写好后台作业文件。",
          "",
          "## Next Action Hint",
          "- 由主会话发起 launch.sh。",
          "",
        ].join("\n"),
        "utf-8",
      );
      await fs.writeFile(
        path.join(workspaceDir, "tasks", taskId, "job.json"),
        `${JSON.stringify(
          {
            version: 1,
            taskId,
            jobId: "train-T01",
            status: "prepared",
            createdAt: "2026-03-16T08:20:00.000Z",
            updatedAt: "2026-03-16T08:20:00.000Z",
            launchPath: `tasks/${taskId}/launch.sh`,
            outputDir: `tasks/${taskId}/outputs/train-T01`,
            logPath: `tasks/${taskId}/logs/run.log`,
            summary: "后台训练文件已准备完成。",
          },
          null,
          2,
        )}\n`,
        "utf-8",
      );
      await fs.writeFile(
        path.join(workspaceDir, "tasks", taskId, "launch.sh"),
        "#!/usr/bin/env bash\nexit 0\n",
        "utf-8",
      );
      await fs.chmod(path.join(workspaceDir, "tasks", taskId, "launch.sh"), 0o755);
      await writeCodingTaskOutputs(workspaceDir, taskId, {
        status: "done",
        summary: "已准备后台长训练。",
        logLine: "[done] 已完成长训练前置检查",
      });
      return {
        status: "done",
        summary: "已准备后台长训练。",
        updated_files: [
          "tasks/T01/plan.md",
          "tasks/T01/summary.md",
          "tasks/T01/outputs/result.json",
          "tasks/T01/logs/run.log",
          "tasks/T01/launch.sh",
          "tasks/T01/job.json",
        ],
        needs_replan: false,
        needs_long_job: true,
        long_job_request: "",
        artifacts: [],
        rawStdout: [
          "RESULT: done",
          "SUMMARY: 已准备后台长训练",
          "PLAN_UPDATE: 已写好 launch.sh、job.json，并在 plan.md 记录结果。",
          "NEXT_HINT: 由主会话发起后台长任务。",
        ].join("\n"),
        rawStderr: "",
        exitCode: 0,
        stdoutBrief: {
          result: "done",
          summary: "已准备后台长训练",
          planUpdate: "已写好 launch.sh、job.json，并在 plan.md 记录结果。",
          nextHint: "由主会话发起后台长任务。",
        },
      };
    });
    const launchLongJob = vi.fn().mockImplementation(async ({ workspaceDir, taskId }) => {
      const jobPath = path.join(workspaceDir, "tasks", taskId, "job.json");
      const current = JSON.parse(await fs.readFile(jobPath, "utf-8")) as Record<string, unknown>;
      await fs.writeFile(
        jobPath,
        `${JSON.stringify(
          {
            ...current,
            status: "running",
            pid: 4321,
            startedAt: "2026-03-16T08:21:00.000Z",
            updatedAt: "2026-03-16T08:21:00.000Z",
          },
          null,
          2,
        )}\n`,
        "utf-8",
      );
      return jobPath;
    });
    const startLongJobSupervisor = vi.fn().mockResolvedValue(undefined);

    const firstTick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: runner,
      now: new Date("2026-03-16T08:20:00.000Z"),
      launchLongJob,
      startLongJobSupervisor,
    });
    expect(firstTick.action).toBe("dispatched_coding_agent");

    const secondTick = await researchTickCommand(runtime, {
      workspace: root,
      roleRunner: runner,
      now: new Date("2026-03-16T08:21:00.000Z"),
      launchLongJob,
      startLongJobSupervisor,
    });

    const state = await readJson<{ activeTaskId?: string; lastAction?: string }>(
      path.join(root, "state.json"),
    );
    const job = await readJson<{ status: string; pid?: number }>(
      path.join(root, "tasks", "T01", "job.json"),
    );

    expect(secondTick.action).toBe("awaiting_long_job_supervisor");
    expect(runner).toHaveBeenCalledTimes(1);
    expect(launchLongJob).toHaveBeenCalledTimes(1);
    expect(startLongJobSupervisor).toHaveBeenCalledTimes(1);
    expect(secondTick.longJobPath).toBe("tasks/T01/job.json");
    expect(state.activeTaskId).toBe("T01");
    expect(state.lastAction).toBe("awaiting_long_job_supervisor");
    expect(job).toMatchObject({ status: "running", pid: 4321 });
  });

  it("requires executing workers to leave plan.md updated", async () => {
    const root = await makeTempDir("openclaw-research-plan-update-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await researchRunCommand(runtime, {
      idea: "agentic literature triage for NLP paper planning",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T08:00:00.000Z"),
    });

    const runner = vi.fn().mockResolvedValue({
      status: "done",
      summary: "声称已完成，但未更新计划。",
      updated_files: [],
      needs_replan: false,
      needs_long_job: false,
      long_job_request: "",
      artifacts: [],
      rawStdout: [
        "RESULT: done",
        "SUMMARY: 声称已完成",
        "PLAN_UPDATE: 未写入 plan.md。",
        "NEXT_HINT: 不应通过校验。",
      ].join("\n"),
      rawStderr: "",
      exitCode: 0,
      stdoutBrief: {
        result: "done",
        summary: "声称已完成",
        planUpdate: "未写入 plan.md。",
        nextHint: "不应通过校验。",
      },
    });

    await expect(
      researchTickCommand(runtime, {
        workspace: root,
        roleRunner: runner,
        now: new Date("2026-03-16T08:05:00.000Z"),
      }),
    ).rejects.toThrow("coding_agent must update tasks/T01/plan.md before exiting.");
  });

  it("requires coding workers to refresh summary, result.json, and run.log", async () => {
    const root = await makeTempDir("openclaw-research-missing-contract-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await researchRunCommand(runtime, {
      idea: "agentic literature triage for NLP paper planning",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T08:00:00.000Z"),
    });

    const runner = vi.fn().mockImplementation(async ({ workspaceDir, taskId }) => {
      const taskPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
      const current = await fs.readFile(taskPath, "utf-8");
      await fs.writeFile(
        taskPath,
        current
          .replace(/\n## 状态\n(?:pending|in_progress)\n/, "\n## 状态\ndone\n")
          .replace("- status: pending", "- status: done")
          .replace(
            "\n## 最近执行结果\n\n- 暂无\n",
            "\n## 最近执行结果\n\n- Coding Agent 已完成当前步骤。\n",
          ),
        "utf-8",
      );
      return {
        status: "done",
        summary: "只更新了 plan。",
        updated_files: ["tasks/T01/plan.md"],
        needs_replan: false,
        needs_long_job: false,
        long_job_request: "",
        artifacts: [],
        rawStdout: [
          "RESULT: done",
          "SUMMARY: 只更新了 plan",
          "PLAN_UPDATE: 已写回 plan.md。",
          "NEXT_HINT: 不应通过校验。",
        ].join("\n"),
        rawStderr: "",
        exitCode: 0,
        stdoutBrief: {
          result: "done",
          summary: "只更新了 plan",
          planUpdate: "已写回 plan.md。",
          nextHint: "不应通过校验。",
        },
      };
    });

    await expect(
      researchTickCommand(runtime, {
        workspace: root,
        roleRunner: runner,
        now: new Date("2026-03-16T08:05:00.000Z"),
      }),
    ).rejects.toThrow("coding_agent must update tasks/T01/summary.md before exiting.");
  });

  it("keeps prior coding outputs when a failed rerun forgets to refresh the contract", async () => {
    const root = await makeTempDir("openclaw-research-preserve-contract-");
    createdDirs.push(root);
    const runtime = {
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await researchRunCommand(runtime, {
      idea: "agentic literature triage for NLP paper planning",
      out: root,
      dryRun: true,
      now: new Date("2026-03-16T08:00:00.000Z"),
    });
    await writeCodingTaskOutputs(root, "T01", {
      status: "done",
      summary: "上一轮执行结果。",
      logLine: "[done] 上一轮执行结果",
    });

    const previousSummary = await fs.readFile(
      path.join(root, "tasks", "T01", "summary.md"),
      "utf-8",
    );
    const previousResult = await fs.readFile(
      path.join(root, "tasks", "T01", "outputs", "result.json"),
      "utf-8",
    );
    const previousLog = await fs.readFile(
      path.join(root, "tasks", "T01", "logs", "run.log"),
      "utf-8",
    );

    const runner = vi.fn().mockImplementation(async ({ workspaceDir, taskId }) => {
      const taskPath = path.join(workspaceDir, "tasks", taskId, "plan.md");
      const current = await fs.readFile(taskPath, "utf-8");
      await fs.writeFile(
        taskPath,
        current
          .replace("\n## 状态\npending\n", "\n## 状态\nin_progress\n")
          .replace(
            "\n## 最近执行结果\n\n- 暂无\n",
            "\n## 最近执行结果\n\n- 本轮失败，但未刷新结果合同。\n",
          ),
        "utf-8",
      );
      return {
        status: "failed",
        summary: "本轮失败。",
        updated_files: ["tasks/T01/plan.md"],
        needs_replan: false,
        needs_long_job: false,
        long_job_request: "",
        artifacts: [],
        rawStdout: [
          "RESULT: failed",
          "SUMMARY: 本轮失败",
          "PLAN_UPDATE: 已在 plan.md 中记录失败。",
          "NEXT_HINT: 需要修复后重试。",
        ].join("\n"),
        rawStderr: "",
        exitCode: 1,
        stdoutBrief: {
          result: "failed",
          summary: "本轮失败",
          planUpdate: "已在 plan.md 中记录失败。",
          nextHint: "需要修复后重试。",
        },
      };
    });

    await expect(
      researchTickCommand(runtime, {
        workspace: root,
        roleRunner: runner,
        now: new Date("2026-03-16T08:05:00.000Z"),
      }),
    ).rejects.toThrow("coding_agent must update tasks/T01/summary.md before exiting.");

    await expect(fs.readFile(path.join(root, "tasks", "T01", "summary.md"), "utf-8")).resolves.toBe(
      previousSummary,
    );
    await expect(
      fs.readFile(path.join(root, "tasks", "T01", "outputs", "result.json"), "utf-8"),
    ).resolves.toBe(previousResult);
    await expect(
      fs.readFile(path.join(root, "tasks", "T01", "logs", "run.log"), "utf-8"),
    ).resolves.toBe(previousLog);
  });
});
