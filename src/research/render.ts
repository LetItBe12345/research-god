import { ensureTrailingLine, slugify } from "./shared.js";
import type {
  ParsedTaskPlan,
  ResearchLayoutSection,
  ResearchCitationEntry,
  ResearchExemplarPaper,
  ResearchRunResult,
  ResearchSectionBrief,
  ResearchSection,
  ResearchSectionCitations,
  ResearchSpecification,
  ResearchWritingStructureSection,
  ResearchTickResult,
  ResearchTodoItem,
} from "./types.js";

export function renderIdeaMarkdown(params: {
  seedIdea: string;
  refinedIdea: string;
  sections: ResearchSection[];
}): string {
  const lines = [
    "# 研究想法",
    "",
    "## 问题定义",
    "",
    params.seedIdea,
    "",
    "## 研究目标",
    "",
    params.refinedIdea,
    "",
    "## 核心假设",
    "",
    "当前方案假设更聚焦的问题设定、方法路径和评估边界可以带来可验证的研究结果。",
    "",
    "## 方法方向",
    "",
    "围绕收敛后的研究方向设计一条可执行的方法主线，并保持实现与实验规模可控。",
    "",
    "## 预期贡献",
    "",
    "产出一条可复现的研究与写作执行路径，以及与该方向对应的论文结构。",
    "",
    "## 原始研究目标",
    "",
    params.seedIdea,
    "",
    "## 收敛后的研究方向",
    "",
    params.refinedIdea,
    "",
    "## 论文章节规划",
    "",
  ];
  for (const section of params.sections) {
    lines.push(`### ${section.id} ${section.name}`);
    lines.push("");
    lines.push(`- dir: ${slugify(section.name)}`);
    lines.push("");
  }
  return ensureTrailingLine(lines.join("\n").trimEnd());
}

function renderCitationEntry(entry: ResearchCitationEntry): string[] {
  return [`### ${entry.title}`, "", entry.citationKey, "", entry.summary, ""];
}

export function renderSectionCitationsMarkdown(
  section: string,
  entries: ResearchCitationEntry[],
): string {
  const lines = [
    `# ${section} 引用候选`,
    "",
    "> 本文件只服务正式引用、related work 和实验论证；写作风格与结构请读取 `papers/` 与后续 `source_sections/`。",
    "",
    "- corpus_role: references",
    "- authority_bib: ../../references.bib",
    "- usage_order: 先核对 references.bib，再筛选本节条目",
    "- style_materials: ./papers/",
    "",
  ];
  for (const entry of entries) {
    lines.push(`### ${entry.title}`);
    lines.push("");
    lines.push(`- cite_key: ${entry.citationKey}`);
    lines.push(`- summary: ${entry.summary}`);
    lines.push("");
  }
  return ensureTrailingLine(lines.join("\n").trimEnd());
}

export function renderLiteratureReviewMarkdown(explicitMarkdown?: string): string | undefined {
  if (!explicitMarkdown || explicitMarkdown.trim().length === 0) {
    return undefined;
  }
  return ensureTrailingLine(explicitMarkdown);
}

export function renderFallbackLiteratureReviewMarkdown(
  citationsBySection: ResearchSectionCitations[],
  explicitMarkdown?: string,
): string {
  if (explicitMarkdown && explicitMarkdown.trim().length > 0) {
    return ensureTrailingLine(explicitMarkdown);
  }
  const lines = ["# Literature Review", ""];
  for (const section of citationsBySection) {
    lines.push(`## ${section.section}`);
    lines.push("");
    for (const entry of section.entries) {
      lines.push(...renderCitationEntry(entry));
    }
  }
  return ensureTrailingLine(lines.join("\n").trimEnd());
}

export function renderSectionBriefMarkdown(brief: ResearchSectionBrief): string {
  const lines = [
    `# ${brief.sectionTitle} Brief`,
    "",
    `- section_id: ${brief.sectionId}`,
    `- section_title: ${brief.sectionTitle}`,
    `- writing_goal: ${brief.writingGoal}`,
    `- latex_output_path: ${brief.latexOutputPath}`,
    "",
    "## Must Cover",
    "",
    ...brief.keyPoints.map((point) => `- ${point}`),
    "",
    "## Questions To Answer",
    "",
    ...brief.questionsToAnswer.map((question) => `- ${question}`),
    "",
    "## Avoid",
    "",
    ...brief.avoidPatterns.map((entry) => `- ${entry}`),
    "",
    "## Source Section Mapping",
    "",
  ];

  if (brief.sourceSections.length === 0) {
    lines.push("- source_sections: none");
    lines.push(
      "- note: 暂无可注入的 source section 文件；需要人工检查对应 `papers/` 下是否已有可用拆分结果。",
    );
  } else {
    for (const sourceSection of brief.sourceSections) {
      lines.push(`- source_section_path: ${sourceSection.relativePath}`);
      lines.push(`  - citation_key: ${sourceSection.citationKey}`);
      lines.push(`  - paper_id: ${sourceSection.paperId}`);
      lines.push(`  - section_title: ${sourceSection.sectionTitle}`);
      lines.push(`  - section_slug: ${sourceSection.sectionSlug}`);
      lines.push(`  - selection_reason: ${sourceSection.selectionReason}`);
    }
  }

  lines.push("");
  lines.push("## Additional Reads");
  lines.push("");
  lines.push(`- references_bib: ${brief.referencesBibPath ?? "none"}`);
  lines.push(`- literature_review: ${brief.literatureReviewPath ?? "none"}`);
  if (brief.experimentResultPaths.length === 0) {
    lines.push("- experiment_result_paths: none");
  } else {
    lines.push("- experiment_result_paths:");
    brief.experimentResultPaths.forEach((entry) => {
      lines.push(`  - ${entry}`);
    });
  }
  if (brief.existingTexPaths.length === 0) {
    lines.push("- existing_tex_paths: none");
  } else {
    lines.push("- existing_tex_paths:");
    brief.existingTexPaths.forEach((entry) => {
      lines.push(`  - ${entry}`);
    });
  }
  return ensureTrailingLine(lines.join("\n").trimEnd());
}

export function renderExemplarMetaMarkdown(params: {
  paperId: string;
  paper: ResearchExemplarPaper;
}): string {
  return ensureTrailingLine(
    [
      `# ${params.paperId} Meta`,
      "",
      `- citation_key: ${params.paper.citationKey}`,
      `- title: ${params.paper.title}`,
      `- pdf_url: ${params.paper.pdfUrl}`,
      `- short_intro: ${params.paper.shortIntro}`,
      `- why_relevant: ${params.paper.whyRelevant}`,
    ].join("\n"),
  );
}

export function renderSpecificationMarkdown(specification: ResearchSpecification): string {
  return ensureTrailingLine(
    [
      "# 研究规范",
      "",
      "## 问题定义",
      "",
      specification.problem,
      "",
      "## 范围",
      "",
      specification.scope,
      "",
      "## 方法",
      ...specification.method.map((entry) => `- ${entry}`),
      "",
      "## 评估",
      ...specification.evaluation.map((entry) => `- ${entry}`),
      "",
      "## 风险",
      ...specification.risks.map((entry) => `- ${entry}`),
      "",
      "## 资源",
      "",
      "### Backbone",
      `- 名称：${specification.resources.backbone.name}`,
      `- 地址：${specification.resources.backbone.url}`,
      `- 备注：${specification.resources.backbone.notes}`,
      "",
      "### 数据集",
      ...specification.resources.datasets.flatMap((entry) => [
        `- 名称：${entry.name}`,
        `  - 地址：${entry.url}`,
        `  - 备注：${entry.notes}`,
      ]),
      "",
      "### 对比方法",
      ...specification.resources.baselines.flatMap((entry) => [
        `- 名称：${entry.name}`,
        `  - 地址：${entry.url}`,
        `  - 备注：${entry.notes}`,
      ]),
      "",
      "## 执行说明",
      "",
      "### 环境",
      ...specification.execution.environment.map((entry) => `- ${entry}`),
      "",
      "### 入口",
      ...specification.execution.entrypoints.flatMap((entry) => [
        `- 路径：${entry.path}`,
        `  - 用途：${entry.purpose}`,
      ]),
      "",
      "### 数据准备命令",
      ...specification.execution.commands.prepare.map((entry) => `- ${entry}`),
      "",
      "### 训练命令",
      ...specification.execution.commands.train.map((entry) => `- ${entry}`),
      "",
      "### 评估命令",
      ...specification.execution.commands.evaluate.map((entry) => `- ${entry}`),
      "",
      "### 预期产物",
      ...specification.execution.expectedArtifacts.map((entry) => `- ${entry}`),
    ].join("\n"),
  );
}

export function renderLayoutMarkdown(
  sections: ReadonlyArray<ResearchSection | ResearchWritingStructureSection>,
): string {
  const lines = [
    "# 落盘约定",
    "",
    "## 章节真源",
    "",
    "- 本文件是 section slug、写作顺序与落盘路径的真源。",
    "- `manuscript/` 由用户预先提供，Research 只校验，不生成投稿模板。",
    "",
    "## Section Layout",
    "",
  ];
  for (const section of sections) {
    const slug = slugify(section.name);
    lines.push(`### ${section.id} ${slug}`);
    lines.push("");
    lines.push(`- section_slug: ${slug}`);
    lines.push(`- materials_dir: section_materials/${slug}/`);
    lines.push(`- citations_file: section_materials/${slug}/citations.md`);
    lines.push(`- brief_file: section_materials/${slug}/brief.md`);
    lines.push(`- manuscript_tex: manuscript/sections/${slug}.tex`);
    if ("writingGoal" in section) {
      lines.push(`- writing_goal: ${section.writingGoal}`);
      lines.push("- key_points:");
      section.keyPoints.forEach((point) => {
        lines.push(`  - ${point}`);
      });
    }
    lines.push("");
  }
  return ensureTrailingLine(lines.join("\n").trimEnd());
}

function toTopLevelTaskLabel(id: string): string {
  const digits = id.match(/^T(\d+)$/)?.[1];
  return digits ? `task_${digits.padStart(2, "0")}` : id.toLowerCase();
}

function validateTopLevelTodoOrder(items: ResearchTodoItem[]): void {
  if (items.length < 6 || items.length > 10) {
    throw new Error(`Top-level todo must contain 6 to 10 items; received ${items.length}.`);
  }
  if (!items.some((item) => item.workerType === "writing")) {
    throw new Error(`Top-level todo must include at least one explicit writing task.`);
  }
  let sawWriting = false;
  for (const item of items) {
    if (item.workerType === "writing") {
      sawWriting = true;
      continue;
    }
    if (sawWriting) {
      throw new Error(`Top-level todo must list all coding tasks before writing tasks.`);
    }
  }
}

function checkboxForStatus(status: ResearchTodoItem["status"]): string {
  return status === "done" ? "[x]" : "[ ]";
}

export function renderTopLevelTodoMarkdown(items: ResearchTodoItem[]): string {
  validateTopLevelTodoOrder(items);
  const lines = [
    "# Todo",
    "",
    "> 仅保留项目级大项；细化步骤与逐轮执行记录不写在这里。",
    "> 每个大项映射一个 task 目录；后续细则应下沉到对应 task 的 `plan.md`。",
    "",
  ];
  for (const item of items) {
    lines.push(
      `- ${checkboxForStatus(item.status)} ${toTopLevelTaskLabel(item.id)} — **${item.workerType}** — ${item.title} (\`${item.subtasksDir}\`)`,
    );
  }
  return ensureTrailingLine(lines.join("\n").trimEnd());
}

function renderPlanAcceptance(entries: string[]): string[] {
  return entries.length > 0 ? entries.map((entry) => `- ${entry}`) : ["- 待补充"];
}

function renderTaskPlanSectionQueue(layoutSections: ResearchLayoutSection[]): string[] {
  return layoutSections.flatMap((section, index) => [
    `### W${String(index + 1).padStart(2, "0")}`,
    `- status: pending`,
    `- section_id: ${section.id}`,
    `- section_slug: ${section.slug}`,
    `- materials_dir: ${section.materialsDir}`,
    `- manuscript_path: ${section.manuscriptTex}`,
    `- acceptance: 完成 ${section.slug} 节草稿，并与对应 section_materials 保持一致。`,
    "",
  ]);
}

export function renderTaskPlanMarkdown(
  item: ResearchTodoItem,
  layoutSections: ResearchLayoutSection[] = [],
): string {
  const executionSection =
    item.workerType === "writing"
      ? ["## Section Queue", "", ...renderTaskPlanSectionQueue(layoutSections)]
      : [
          "## Step List",
          "",
          "### S01",
          "- status: pending",
          `- task: ${item.objective}`,
          `- acceptance: ${item.acceptance[0] ?? "完成当前 coding 任务的首个可验证步骤。"}`,
          "",
        ];

  return ensureTrailingLine(
    [
      `# ${item.id} ${item.title}`,
      "",
      "## Worker Type",
      item.workerType,
      "",
      "## 状态",
      item.status,
      "",
      "## 目标",
      item.objective,
      "",
      "## 验收标准",
      ...renderPlanAcceptance(item.acceptance),
      "",
      ...executionSection,
      "## Blockers",
      "",
      "- 暂无",
      "",
      "## 最近执行结果",
      "",
      "- 暂无",
      "",
      "## Next Action Hint",
      "",
      item.workerType === "writing"
        ? "- 从 W01 开始，先核对首节的 brief、citations 与 manuscript 路径。"
        : "- 从 S01 开始，先完成第一个可验证步骤并同步更新状态。",
    ].join("\n"),
  );
}

export function renderParsedTaskPlanMarkdown(task: ParsedTaskPlan): string {
  const executionSection =
    task.workerType === "writing"
      ? [
          "## Section Queue",
          "",
          ...(task.sectionQueue.length > 0
            ? task.sectionQueue.flatMap((entry) => [
                `### ${entry.id}`,
                `- status: ${entry.status}`,
                `- section_id: ${entry.sectionId}`,
                `- section_slug: ${entry.sectionSlug}`,
                `- materials_dir: ${entry.materialsDir}`,
                `- manuscript_path: ${entry.manuscriptPath}`,
                `- acceptance: ${entry.acceptance}`,
                "",
              ])
            : [""]),
        ]
      : [
          "## Step List",
          "",
          ...(task.steps.length > 0
            ? task.steps.flatMap((entry) => [
                `### ${entry.id}`,
                `- status: ${entry.status}`,
                `- task: ${entry.task}`,
                `- acceptance: ${entry.acceptance}`,
                "",
              ])
            : [""]),
        ];

  return ensureTrailingLine(
    [
      `# ${task.id} ${task.title}`,
      "",
      "## Worker Type",
      task.workerType,
      "",
      "## 状态",
      task.status,
      "",
      "## 目标",
      task.objective || "待补充",
      "",
      "## 验收标准",
      ...renderPlanAcceptance(task.acceptance),
      "",
      ...executionSection,
      "## Blockers",
      "",
      ...(task.blockers.length > 0 ? task.blockers.map((entry) => `- ${entry}`) : ["- 暂无"]),
      "",
      "## 最近执行结果",
      "",
      `- ${task.lastRunResult || "暂无"}`,
      "",
      "## Next Action Hint",
      "",
      `- ${task.nextActionHint || "暂无"}`,
    ].join("\n"),
  );
}

export function renderWorkspaceAgentsMarkdown(): string {
  return ensureTrailingLine(
    [
      "# Research Workspace Orchestrator",
      "",
      "你是当前 research workspace 的主会话秘书。",
      "你只负责读取 workspace、选择 next action、派发 worker，不直接替代 worker 执行大量编码或写作。",
      "",
      "## 长期规则",
      "- workspace 是唯一真源；以 `todo.md`、`layout.md`、`tasks/Txx/plan.md`、`summary.md`、`outputs/`、`logs/` 和 `section_materials/` 的落盘状态为准。",
      "- 顶层调度总是先读 `todo.md`，确认当前未完成大项及其 `coding` / `writing` 类型，再读该任务的 `plan.md` 与材料状态。",
      "- `stdout`、`stderr` 和 exit code 只提供本轮即时反馈，不替代 workspace 文件。",
      "- `agents/` 下的 `AGENTS.md` 只是 worker 模板；主会话不要假设自己会自动注入这些文件。",
      "- 运行时记录写在 `runtime/dispatch_log.md` 与 `runtime/session_notes.md`。",
      "",
      "## 调度边界",
      "- 每一轮只能选择一个 next action。",
      "- 同一时刻只允许一个执行型 worker 工作。",
      "- 只有当前任务缺少可执行步骤、queue item 或出现 blocker 时，才派 `step_planner`。",
      "- 当前任务已有明确步骤时，优先派 `coding_agent` 或 `writing_agent`，不要重复派规划者。",
      "- 只要顶层 `todo.md` 里仍有未完成的 `coding` 大项，就不得开始任何 `writing` 大项。",
      "",
      "## Writing 规则",
      "- Writing 总是按 `layout.md` 与当前任务 `Section Queue` 逐 section 派发，一次只推进一个 section。",
      "- 派发前必须核对当前 queue item 与 `layout.md` 一致，并检查 `brief.md`、两篇榜样论文目录、所选 source section Markdown、目标 `manuscript/sections/<section>.tex` 路径都已齐备。",
      "- 派发 Writing 时，必须显式注入当前 section 的材料合同：`brief.md`、`citations.md`、目标 `manuscript/sections/<section>.tex`、根级 `references.bib`，以及秘书选中的 source section Markdown 集合。",
      "- `literature_review.md` 只按需补充，不替代上述必需材料。",
      "- `papers/` 与 `source_sections/` 只用于学习写作风格、section 组织和论证展开，不作为正式引用真源。",
      "",
      "## Worker 边界",
      "- `step_planner` 只改当前 `tasks/Txx/plan.md`，不改代码、不改论文、不改顶层 `todo.md`。",
      "- `coding_agent` 只执行当前 plan 的第一个可执行 coding 步骤，可改代码与当前任务文件，但不改顶层 `todo.md`。",
      "- `writing_agent` 只执行当前 queue 的第一个可执行 section，可改 LaTeX、相关 section 材料与当前任务文件，但不改顶层 `todo.md`。",
      "",
      "## 长任务规则",
      "- 执行者不能直接启动长训练或长写作流水线。",
      "- 执行者只能提交 long-job request。",
      "- 只有你可以批准并提交后台长任务。",
    ].join("\n"),
  );
}

export function renderRoleAgentsMarkdown(
  role: "step_planner" | "coding_agent" | "writing_agent",
): string {
  const sections =
    role === "step_planner"
      ? [
          "# Step Planner",
          "",
          "你是当前 research workspace 的步骤规划者。",
          "你只负责把当前任务整理成可执行状态，不负责写代码，不负责全局调度。",
          "",
          "## 角色合同",
          "- 只处理当前被派发的那一个任务。",
          "- 只读取本轮任务包显式给出的 workspace 文件，不假设其他 `agents/*/AGENTS.md` 会自动注入。",
          "- 只修改当前 `tasks/Txx/plan.md`。",
          "- 保持任务可执行，但不要把步骤拆得过细；主会话每轮仍只会选择一个 next action。",
          "- Writing 任务的 `Section Queue` 必须严格沿用 `layout.md` 的 section 顺序，不得自行增删或重排章节。",
          "- 回执保持很短，任务文件才是状态源。",
          "",
          "## 禁止事项",
          "- 不要修改 `todo.md`。",
          "- 不要修改代码文件。",
          "- 不要修改论文文件。",
          "- 不要启动长任务。",
          "- 不要替代秘书做全局调度。",
        ]
      : role === "coding_agent"
        ? [
            "# Coding Agent",
            "",
            "你是当前 research workspace 的代码执行者。",
            "你的工作是执行当前任务 plan 中第一个未完成且可执行的 coding 步骤。",
            "",
            "## 角色合同",
            "- 只处理当前被派发的那一个任务。",
            "- 只读取本轮任务包显式给出的 workspace 文件，不假设其他 `agents/*/AGENTS.md` 会自动注入。",
            "- 读取当前 `tasks/Txx/plan.md`、`specification.md`、`layout.md` 和相关代码。",
            "- 修改代码、脚本、配置，以及当前 `tasks/Txx/plan.md`。",
            "- 把产物写到当前 task 目录下的约定位置。",
            "- 如果遇到阻塞，要把 blocker 清楚写进当前任务文件。",
            "- 回执保持很短，任务文件和 long-job request 才是状态源。",
            "",
            "## 禁止事项",
            "- 不要修改 `todo.md`。",
            "- 不要重写整个研究路线。",
            "- 不要代替写作 worker 去写 section 正文。",
            "- 不要直接启动长任务；只能提交 long-job request。",
          ]
        : [
            "# Writing Agent",
            "",
            "你是当前 research workspace 的论文执行者。",
            "你的工作是基于现有实验结果和显式注入的 section 材料，完成当前 queue 中唯一可执行的 section。",
            "",
            "## 角色合同",
            "- 使用 LaTeX 产出并修改目标 section，对齐 `manuscript/sections/<section>.tex`。",
            "- 一次只写一个 section；以当前任务 `Section Queue` 中第一个未完成且可执行的 item 为准。",
            "- 必须先读取 `agents/writing/AGENTS.md` 与当前 section task package，再读取 `brief.md` 与 task package 列出的 source section Markdown 集合。",
            "- 只有在 `brief.md` / task package 显式声明时，才额外读取 `references.bib`、当前 section 的 `citations.md`、`literature_review.md`、结果文件或已有 `.tex`。",
            "- 正式引用与 related work：先核对根级 `references.bib`，再读取当前 section 下的待引用 Markdown（通常是 `citations.md`）；`literature_review.md` 仅按需补充。",
            "- 榜样论文材料 `papers/` 与 `source_sections/` 只用于学习写作风格和 section 组织，不作为正式引用真源。",
            "- 修改论文、LaTeX、当前 section 的相关材料，以及当前 `tasks/Txx/plan.md`。",
            "- 不允许跨 section 发散；不要提前写下一个 section。",
            "- 只依据已有证据写作，不得编造结果。",
            "- 回执保持很短，任务文件和 long-job request 才是状态源。",
            "",
            "## 禁止事项",
            "- 不要修改 `todo.md`。",
            "- 不要虚构实验结论。",
            "- 不要重写研究路线。",
            "- 不要一次并行推进多个 section。",
          ];
  return ensureTrailingLine(sections.join("\n"));
}

export function renderWorkspaceStateMarkdown(now: Date, activeTaskId?: string): string {
  return `${JSON.stringify(
    {
      version: 1,
      activeTaskId,
      updatedAt: now.toISOString(),
    },
    null,
    2,
  )}\n`;
}

export function formatTickSummary(result: ResearchTickResult): string {
  const lines = [`Research tick finished: ${result.action}`, `Workspace: ${result.workspaceDir}`];
  if (result.activeTaskId) {
    lines.push(`Active task: ${result.activeTaskId}`);
  }
  if (result.dispatchedRole) {
    lines.push(`Role: ${result.dispatchedRole}`);
  }
  if (result.longJobPath) {
    lines.push(`Long job: ${result.longJobPath}`);
  }
  lines.push(result.summary);
  return lines.join("\n");
}

export function formatResultSummary(result: ResearchRunResult): string {
  return [
    `Research workspace prepared${result.dryRun ? " (dry run)" : ""}.`,
    `Workspace: ${result.outputDir}`,
    `Workspace AGENTS: ${result.workspaceAgentsPath}`,
    `Idea: ${result.ideaPath}`,
    `Specification: ${result.specificationPath}`,
    `Layout: ${result.layoutPath}`,
    `References: ${result.referencesPath}`,
    `Todo: ${result.todoPath}`,
  ].join("\n");
}
