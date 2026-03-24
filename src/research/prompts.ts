import path from "node:path";
import type { ResearchRoleName, ResearchSection } from "./types.js";
import { resolveWritingTaskPackageRelativePath } from "./writing.js";

export function buildIdeaPrompt(params: { idea: string; count: number }): string {
  return [
    "你现在负责 research pipeline 的第 1 阶段：idea refinement。",
    "",
    "目标：",
    `- 内部探索 ${params.count} 个候选方向。`,
    "- 只选择一个最值得推进的方向，输出最终 refined idea。",
    "- 设计论文 section 结构，要求具体、可执行、文件系统安全。",
    "- 优先吸收原始研究目标中给出的约束：目标会议、目标赛道、研究领域、个人能力背景、算力预算、实验可行性。",
    "- 如果原始研究目标要求参考最新文献，优先综合 2025 年及之后的相关顶会工作与趋势，但不要虚构具体论文细节。",
    "- 产出的方向必须兼顾创新性与落地性，避免依赖大规模预训练、超大算力或难以获取的数据闭源条件。",
    "- 如果原始研究目标同时提到主会与 Data / Datasets / Benchmarks 等赛道，优先给出一个主会取向的核心方向，并确保它也能自然扩展到数据集或 benchmark 贡献。",
    "- refined idea 应该是一段高密度研究提案，而不是一句口号；需要明确问题、切入点、为什么值得做、为什么在给定约束下可做。",
    "- sections 只是一个轻量目录，用来确定章节集合与顺序；详细到“每节具体写什么”会在下一阶段单独生成。",
    "- 每个 section 只需要包含 id 和 name。",
    "- name 同时作为章节名和后续本地目录名来源，所以要简短、稳定、文件系统安全，优先使用真实学术论文章节名的 slug 化版本，例如 introduction、related-work、method、experiments、analysis、conclusion。",
    "- 不要发明论文中不存在的章节名（如 problem-setup、data-benchmark）。",
    "- 典型的计算机科学论文结构是：Introduction → Related Work → Method → Experiments → Conclusion，可根据具体研究方向微调，但应遵循学术惯例。",
    "",
    "只返回 JSON，不要包 markdown fence，结构如下：",
    "{",
    '  "refinedIdea": "string",',
    '  "sections": [{"id":"S01","name":"introduction"}]',
    "}",
    "",
    "原始研究目标：",
    params.idea,
  ].join("\n");
}

export function buildWritingStructurePrompt(): string {
  return [
    "你现在负责 research pipeline 的第 2 阶段：writing structure。",
    "",
    "使用 previous_response_id 延续 idea 阶段上下文。",
    "不要在当前 prompt 里重复粘贴前一阶段产物。",
    "你的任务不是重新发明研究方向，而是把已有 refined idea 变成可写作的 section-level brief。",
    "你必须保留上游已经确定的 section ids 与 section names，不得增删、改名、合并、拆分或重排章节。",
    "你输出的内容会被落盘为：",
    "- 根级 `layout.md`：章节顺序与路径真源",
    "- 各 section 目录下的 `brief.md`：该 section 具体应该写什么",
    "",
    "每个 section 必须给出：",
    "- `id`：沿用上游 section id",
    "- `name`：沿用上游 section name",
    "- `writingGoal`：一句到两句，说明本节的核心写作目的",
    "- `keyPoints`：本节必须覆盖的要点列表",
    "- `questionsToAnswer`：本节应回答的问题列表",
    "- `avoidPatterns`：本节应避免的写法列表",
    "- `requiredContext`：从 `references_bib`、`literature_review`、`experiment_results`、`existing_tex` 中选择需要注入的上下文",
    "",
    "规则：",
    "- `requiredContext` 只选本节真正需要的材料；不要默认全选。",
    "- abstract 通常依赖 experiment_results，不需要 literature_review。",
    "- introduction / related-work 往往需要 references_bib，且常需要 literature_review。",
    "- method 通常不需要 literature_review，除非确有必要。",
    "- experiments 往往需要 experiment_results，必要时再加 references_bib 或 literature_review。",
    "- conclusion 通常不需要 literature_review，若要总结结果可使用 experiment_results。",
    "",
    "只返回 JSON，不要包 markdown fence，结构如下：",
    "{",
    '  "sections": [',
    "    {",
    '      "id": "S01",',
    '      "name": "introduction",',
    '      "writingGoal": "string",',
    '      "keyPoints": ["string"],',
    '      "questionsToAnswer": ["string"],',
    '      "avoidPatterns": ["string"],',
    '      "requiredContext": ["references_bib"]',
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

export function buildSpecificationPrompt(): string {
  return [
    "你现在负责 research pipeline 的第 3 阶段：specification。",
    "",
    "使用 previous_response_id 延续上一阶段上下文。",
    "不要在当前 prompt 里重复粘贴前一阶段产物。",
    "请基于已有上下文，写出一份可复现实验说明书级别的 research specification。",
    "目标是让后续 agent 在尽量少调用 web search 的情况下，就能开始复现实验。",
    "因此你必须尽量给出：",
    "- 主干模型或 backbone 的名称、下载地址或官方主页地址",
    "- 数据集的下载地址、主页地址或官方获取入口",
    "- 对比方法或 baseline 的代码仓库、模型仓库或论文主页地址",
    "- 关键代码入口、脚本入口或推荐的本地目录布局",
    "- 数据准备、训练、评估的建议命令或命令模板",
    "- 复现后应当看到的关键产物",
    "如果某个链接或入口无法从现有上下文可靠确定，请明确写 UNKNOWN，不要编造。",
    "这个阶段的重点不是写漂亮文字，而是给执行者留下足够具体的可复现信息。",
    "",
    "你必须只返回 markdown，不要输出 JSON，不要包 markdown fence。",
    "markdown 必须严格包含下面这些一级或二级标题，标题名称不要改：",
    "# 研究规范",
    "## 问题定义",
    "## 范围",
    "## 方法",
    "## 评估",
    "## 风险",
    "## 资源",
    "### Backbone",
    "### 数据集",
    "### 对比方法",
    "## 执行说明",
    "### 环境",
    "### 入口",
    "### 数据准备命令",
    "### 训练命令",
    "### 评估命令",
    "### 预期产物",
    "",
    "格式要求：",
    "- `## 方法`、`## 评估`、`## 风险`、`### 环境`、`### 数据准备命令`、`### 训练命令`、`### 评估命令`、`### 预期产物` 使用 bullet list。",
    "- `### Backbone` 使用 3 条 bullet：`名称`、`地址`、`备注`。",
    "- `### 数据集` 和 `### 对比方法` 可以包含多组条目；每组条目必须从 `- 名称：...` 开始，随后紧跟 `- 地址：...` 和 `- 备注：...`。",
    "- `### 入口` 可以包含多组条目；每组条目必须从 `- 路径：...` 开始，随后紧跟 `- 用途：...`。",
    "- 所有地址都尽量写具体链接；如果无法可靠确定，写 `UNKNOWN`。",
  ].join("\n");
}

export function buildPaperPrompt(): string {
  return [
    "你现在负责 research pipeline 的第 4 阶段：paper references。",
    "",
    "使用 previous_response_id 延续已有上下文。",
    "你的目标只有两个：生成根级 references.bib，以及每个 section 的最小引用列表。",
    "不要生成榜样论文，不要生成 literature review，不要输出额外说明。",
    "如果需要工具，只优先使用 web search 去核实真实文献。",
    "",
    "输入语义只来自已经确定的研究方向和 canonical section 结构。",
    "章节名称以上游已确定的 section 为准，不要自己改名。",
    "section 引用的 `citationKey` 必须都能在 `bib` 中找到。",
    "每个 section 只保留最小必要信息：标题、citationKey、一句话简介。",
    "某个 section 如果确实不需要引用，可以返回空 entries。",
    "",
    "只返回 JSON，不要包 markdown fence，结构如下：",
    "{",
    '  "bib": "@inproceedings{key, ...}",',
    '  "sections": [',
    '    {',
    '      "section": "introduction",',
    '      "entries": [',
    '        {"title":"string","citationKey":"string","summary":"string"}',
    "      ]",
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

export function buildPaperPromptWithContext(params: {
  ideaMarkdown: string;
  layoutMarkdown: string;
}): string {
  return [
    "你现在负责 research pipeline 的第 4 阶段：paper references。",
    "",
    "当前 API 不可靠地支持 previous_response_id，所以这里显式提供两个上游 markdown 文件作为上下文。",
    "你的目标只有两个：生成根级 references.bib，以及每个 section 的最小引用列表。",
    "不要生成榜样论文，不要生成 literature review，不要输出额外说明。",
    "如果需要工具，只优先使用 web search 去核实真实文献。",
    "",
    "你必须只根据下面两个文件的内容来理解任务，不要扩展到 specification.md、todo.md、brief.md 或其他文件。",
    "",
    "idea.md：",
    params.ideaMarkdown,
    "",
    "layout.md：",
    params.layoutMarkdown,
    "",
    "section 引用的 `citationKey` 必须都能在 `bib` 中找到。",
    "每个 section 只保留最小必要信息：标题、citationKey、一句话简介。",
    "某个 section 如果确实不需要引用，可以返回空 entries。",
    "",
    "只返回 JSON，不要包 markdown fence，结构如下：",
    "{",
    '  "bib": "@inproceedings{key, ...}",',
    '  "sections": [',
    '    {',
    '      "section": "introduction",',
    '      "entries": [',
    '        {"title":"string","citationKey":"string","summary":"string"}',
    "      ]",
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

export function buildTodoPrompt(): string {
  return [
    "你现在负责 research pipeline 的第 5 阶段：top-level todo。",
    "",
    "使用 previous_response_id 延续上文。",
    "不要在当前 prompt 里重复粘贴已有产物。",
    "请严格只根据 idea.md 与 specification.md 对应的既有研究方案，生成一个粗粒度但可执行的顶层 todo 列表。",
    "注意：顶层 todo 只负责大任务，不要把它拆得过细。",
    "不要把 layout、references、literature_review、section_materials 等产物当作输入依据。",
    "总条数必须是 6 到 10 条。",
    "每条必须显式写 workerType，且只能是 coding 或 writing。",
    "所有 coding 项必须排在 writing 项之前。",
    "必须至少包含一个显式 writing 顶层任务，不能靠标题关键词暗示。",
    "标题只写项目级目标；细粒度执行步骤留给对应 task 的 plan.md。",
    "",
    "只返回 JSON，不要包 markdown fence，结构如下：",
    "{",
    '  "todo": [{"id":"T01","title":"string","workerType":"coding","objective":"string","acceptance":["string"],"status":"pending","subtasksDir":"tasks/T01/"}]',
    "}",
  ].join("\n");
}

export function buildWritingStructurePromptWithContext(params: {
  seedIdea: string;
  refinedIdea: string;
  sections: ResearchSection[];
}): string {
  return [
    "你现在负责 research pipeline 的第 2 阶段：writing structure。",
    "",
    "当前 API 不可靠地支持 previous_response_id，所以这里显式提供上游上下文。",
    "请根据下面已经确定的 refined idea 与 section 列表，生成 section-level writing structure。",
    "不要改 section 的数量、id、name、顺序；只补充每节的写作职责与写作上下文需求。",
    "",
    "原始研究目标：",
    params.seedIdea,
    "",
    "refined idea：",
    params.refinedIdea,
    "",
    "sections(JSON)：",
    JSON.stringify(params.sections, null, 2),
    "",
    "每个 section 必须返回：`id`、`name`、`writingGoal`、`keyPoints`、`questionsToAnswer`、`avoidPatterns`、`requiredContext`。",
    "`requiredContext` 只能从 `references_bib`、`literature_review`、`experiment_results`、`existing_tex` 中选择。",
    "",
    "只返回 JSON，不要包 markdown fence，结构如下：",
    "{",
    '  "sections": [{"id":"S01","name":"introduction","writingGoal":"string","keyPoints":["string"],"questionsToAnswer":["string"],"avoidPatterns":["string"],"requiredContext":["references_bib"]}]',
    "}",
  ].join("\n");
}

export function buildSpecificationPromptWithContext(params: {
  seedIdea: string;
  refinedIdea: string;
  sections: ResearchSection[];
}): string {
  return [
    "你现在负责 research pipeline 的第 3 阶段：specification。",
    "",
    "当前 API 不可靠地支持 previous_response_id，所以这里显式提供上游上下文。",
    "请基于下面的 idea 阶段结果，写出一份可复现实验说明书级别的 research specification。",
    "目标是让后续 agent 在尽量少调用 web search 的情况下，就能开始复现实验。",
    "因此你必须尽量给出：",
    "- 主干模型或 backbone 的名称、下载地址或官方主页地址",
    "- 数据集的下载地址、主页地址或官方获取入口",
    "- 对比方法或 baseline 的代码仓库、模型仓库或论文主页地址",
    "- 关键代码入口、脚本入口或推荐的本地目录布局",
    "- 数据准备、训练、评估的建议命令或命令模板",
    "- 复现后应当看到的关键产物",
    "如果某个链接或入口无法从现有上下文可靠确定，请明确写 UNKNOWN，不要编造。",
    "",
    "原始研究目标：",
    params.seedIdea,
    "",
    "refined idea：",
    params.refinedIdea,
    "",
    "sections(JSON)：",
    JSON.stringify(params.sections, null, 2),
    "",
    "你必须只返回 markdown，不要输出 JSON，不要包 markdown fence。",
    "markdown 必须严格包含下面这些标题，标题名称不要改：",
    "# 研究规范",
    "## 问题定义",
    "## 范围",
    "## 方法",
    "## 评估",
    "## 风险",
    "## 资源",
    "### Backbone",
    "### 数据集",
    "### 对比方法",
    "## 执行说明",
    "### 环境",
    "### 入口",
    "### 数据准备命令",
    "### 训练命令",
    "### 评估命令",
    "### 预期产物",
    "",
    "格式要求：",
    "- `## 方法`、`## 评估`、`## 风险`、`### 环境`、`### 数据准备命令`、`### 训练命令`、`### 评估命令`、`### 预期产物` 使用 bullet list。",
    "- `### Backbone` 使用 3 条 bullet：`名称`、`地址`、`备注`。",
    "- `### 数据集` 和 `### 对比方法` 可以包含多组条目；每组条目必须从 `- 名称：...` 开始，随后紧跟 `- 地址：...` 和 `- 备注：...`。",
    "- `### 入口` 可以包含多组条目；每组条目必须从 `- 路径：...` 开始，随后紧跟 `- 用途：...`。",
    "- 所有地址都尽量写具体链接；如果无法可靠确定，写 `UNKNOWN`。",
  ].join("\n");
}

export function buildTodoPromptWithContext(params: {
  ideaMarkdown: string;
  specificationMarkdown: string;
}): string {
  return [
    "你现在负责 research pipeline 的第 5 阶段：top-level todo。",
    "",
    "当前 API 不可靠地支持 previous_response_id，所以这里显式提供上游上下文。",
    "请严格只根据下面已经落盘的 idea.md 和 specification.md，生成一个粗粒度但可执行的顶层 todo 列表。",
    "注意：顶层 todo 只负责大任务，不要把它拆得过细。",
    "总条数必须是 6 到 10 条。",
    "每条必须显式写 workerType，且只能是 coding 或 writing。",
    "所有 coding 项必须排在 writing 项之前。",
    "必须至少包含一个显式 writing 顶层任务，不能靠标题关键词暗示。",
    "标题只写项目级目标；细粒度执行步骤留给对应 task 的 plan.md。",
    "",
    "idea.md：",
    params.ideaMarkdown,
    "",
    "specification(markdown)：",
    params.specificationMarkdown,
    "",
    "只返回 JSON，不要包 markdown fence，结构如下：",
    "{",
    '  "todo": [{"id":"T01","title":"string","workerType":"coding","objective":"string","acceptance":["string"],"status":"pending","subtasksDir":"tasks/T01/"}]',
    "}",
  ].join("\n");
}

export function buildTaskPrompt(params: {
  role: ResearchRoleName;
  task: {
    id: string;
    title: string;
    dir: string;
    workerType?: "coding" | "writing";
    sectionQueue?: Array<{
      id: string;
      status: "done" | "in_progress" | "pending";
      sectionSlug: string;
      materialsDir: string;
      manuscriptPath: string;
    }>;
  };
  workspaceDir: string;
  agentWorkspaceDir?: string;
}): string {
  const makeRelative = (target: string) => {
    const baseDir = params.agentWorkspaceDir ?? params.workspaceDir;
    const relative = path.relative(baseDir, path.join(params.workspaceDir, target));
    return relative.length > 0 ? relative.split(path.sep).join(path.posix.sep) : ".";
  };
  const taskPath = makeRelative(path.posix.join(params.task.dir, "plan.md"));
  const summaryPath = makeRelative(path.posix.join(params.task.dir, "summary.md"));
  const resultJsonPath = makeRelative(path.posix.join(params.task.dir, "outputs", "result.json"));
  const runLogPath = makeRelative(path.posix.join(params.task.dir, "logs", "run.log"));
  const launchPath = makeRelative(path.posix.join(params.task.dir, "launch.sh"));
  const jobPath = makeRelative(path.posix.join(params.task.dir, "job.json"));
  const monitorPath = makeRelative(path.posix.join(params.task.dir, "monitor.sh"));
  const reads = [
    makeRelative("todo.md"),
    taskPath,
    makeRelative("specification.md"),
    makeRelative("layout.md"),
  ];
  const nextWritingSection =
    params.task.workerType === "writing"
      ? (params.task.sectionQueue?.find((entry) => entry.status !== "done") ??
        params.task.sectionQueue?.[0])
      : undefined;
  const writingTaskPackagePath =
    nextWritingSection === undefined
      ? undefined
      : makeRelative(resolveWritingTaskPackageRelativePath(params.task.dir, nextWritingSection.id));
  const injectedWritingReads =
    nextWritingSection === undefined
      ? []
      : [
          "AGENTS.md",
          writingTaskPackagePath!,
          makeRelative(path.posix.join(nextWritingSection.materialsDir, "brief.md")),
          makeRelative(nextWritingSection.manuscriptPath),
          "source section Markdown 集合：以当前 section task package 中列出的路径为准，不要扫描整个 papers/ 目录",
        ];
  if (params.role === "step_planner") {
    return [
      "# 当前任务包",
      "",
      `角色：step_planner`,
      `任务：${params.task.id} ${params.task.title}`,
      `工作区根目录：${makeRelative(".")}`,
      "",
      "只读最小必要上下文：",
      ...reads.map((entry) => `- ${entry}`),
      "",
      "执行要求：",
      `1. 只修改 ${taskPath}。`,
      "2. 把当前任务整理成可执行状态，但不要拆得过细。",
      "3. 如果当前任务是 writing，Section Queue 必须保持与 layout.md 一致，并按固定顺序一次只推进一个 section。",
      "4. 不要修改代码，不要修改论文，也不要修改顶层 todo.md。",
      "5. 任务文件是唯一状态源；是否需要继续执行要体现在任务文件里。",
      "6. `stdout` 只做本轮简报，不做长期状态存储。",
      "",
      "回执要求：",
      "1. 只返回 OpenClaw 规定的 4 行短报告：`RESULT`、`SUMMARY`、`PLAN_UPDATE`、`NEXT_HINT`。",
      "2. `RESULT` 只能是 `done`、`blocked` 或 `failed`。",
      "3. `PLAN_UPDATE` 必须概括你刚刚写入 `plan.md` 的更新。",
      "4. 不要在回执里重复大段上下文。",
    ].join("\n");
  }
  if (params.role === "writing_agent") {
    return [
      "# 当前任务包",
      "",
      `角色：writing_agent`,
      `任务：${params.task.id} ${params.task.title}`,
      `工作区根目录：${makeRelative(".")}`,
      "",
      "只读最小必要上下文：",
      ...reads.map((entry) => `- ${entry}`),
      "",
      "本轮必须注入的当前 section 材料：",
      ...(injectedWritingReads.length > 0
        ? injectedWritingReads.map((entry) => `- ${entry}`)
        : ["- 当前写作 section 尚未解析，请先核对 task plan 与 layout.md。"]),
      "",
      "执行要求：",
      `1. 执行 ${taskPath} 中第一个未完成且可执行的 queue item，一次只写一个 section。`,
      "2. 必须先读 `agents/writing/AGENTS.md` 与当前 section task package，再读 brief.md 和 task package列出的 source section Markdown。",
      "3. 只有当 task package / brief.md 明确声明时，才额外读取 `citations.md`、`references.bib`、`literature_review.md`、`summary.md`、`outputs/result.json` 或已有 `.tex`。",
      "4. 正式引用与 related work 先看 `references.bib`，再看当前 section 的 `citations.md`；`papers/` 与 `source_sections/` 只用于风格和结构。",
      "5. 只处理当前 queue item 对应的 section，不要跨 section 发散，也不要提前写下一个 section。",
      "6. 写作正文必须是 LaTeX section 文件，写到当前 queue item 对应的 `manuscript/sections/<section>.tex`。",
      "7. 需要引用时只能使用当前材料里真实存在的 cite key，并写成 `\\cite{key}`；不要伪造引用，不要把论文标题当引用写进正文。",
      "8. 结束前必须更新 `plan.md`；如果本轮暴露了跨 section 假设、引用缺口或人工接力事项，补写 `runtime/session_notes.md`。",
      "9. 保留已有产物；失败时也不要删除已有 `.tex` 或已有记录。",
      `10. Writing 不应启动长任务；如果缺材料或依赖实验结果，只能在 ${taskPath} 写 blocker。`,
      "11. `stdout` 只做本轮简报，不做长期状态存储。",
      "12. 写完后自行做一次最基本的 LaTeX sanity check，至少避免把 Markdown 当 `.tex` 落盘。",
      "13. 不要修改顶层 todo.md，不得编造实验结论。",
      "",
      "回执要求：",
      "1. 只返回 OpenClaw 规定的 4 行短报告：`RESULT`、`SUMMARY`、`PLAN_UPDATE`、`NEXT_HINT`。",
      "2. `RESULT` 只能是 `done`、`blocked` 或 `failed`。",
      "3. `PLAN_UPDATE` 必须概括你刚刚写入 `plan.md` 的更新。",
      "4. 任务文件才是状态源。",
      "",
    ].join("\n");
  }
  return [
    "# 当前任务包",
    "",
    `角色：coding_agent`,
    `任务：${params.task.id} ${params.task.title}`,
    `工作区根目录：${makeRelative(".")}`,
    "",
    "只读最小必要上下文：",
    ...reads.map((entry) => `- ${entry}`),
    "",
    "执行要求：",
    `1. 执行 ${taskPath} 中第一个未完成且可执行的步骤。`,
    `2. 可以修改代码、脚本、配置，以及 ${taskPath}。`,
    `3. Coding 结束前必须同时写完这组最小结果：${taskPath}、${summaryPath}、${resultJsonPath}，并向 ${runLogPath} 追加一条运行记录。`,
    `4. ${resultJsonPath} 必须是合法 JSON，至少包含 taskId、status、summary。`,
    "5. 失败时也要保留已有输出，不要删除已有 `summary.md`、`outputs/result.json` 或 `logs/run.log`。",
    "6. 如果遇到阻塞，要在当前任务文件里写清楚 blocker。",
    "7. 不要修改顶层 todo.md。",
    `8. 短任务定义：预计 15 分钟内完成的改代码、单测、sanity check、小规模 dry-run 可以直接执行；如果预计超过 15 分钟、需要后台训练/评测/守护进程，就不要在当前会话里阻塞运行。`,
    `9. 长任务只允许准备文件，不允许前台等待：至少落盘 ${launchPath} 与 ${jobPath}；必要时补 ${monitorPath}。job.json 至少写 taskId、jobId、status、launchPath、outputDir、logPath、summary；如有 service name / pid 也写进去。`,
    "10. 长任务的脚本、配置和输出路径都要在当前 task 目录或 workspace 中落盘清楚，让主会话后续只负责发起、supervisor 负责收尾。",
    "11. `stdout` 只做本轮简报，不做长期状态存储。",
    "",
    "回执要求：",
    "1. 只返回 OpenClaw 规定的 4 行短报告：`RESULT`、`SUMMARY`、`PLAN_UPDATE`、`NEXT_HINT`。",
    "2. `RESULT` 只能是 `done`、`blocked` 或 `failed`。",
    "3. `PLAN_UPDATE` 必须概括你刚刚写入 `plan.md` 的更新。",
    "4. 如果本轮准备了长任务，PLAN_UPDATE 必须明确说明已经写好的 launch.sh/job.json/monitor.sh。",
  ].join("\n");
}
