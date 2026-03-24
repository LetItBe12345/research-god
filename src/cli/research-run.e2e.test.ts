import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "./program.js";

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

  const sourceSectionMarkdown = (paperTitle: string, citationKey: string) =>
    [
      "# Introduction",
      "",
      `- paper_title: ${paperTitle}`,
      `- citation_key: ${citationKey}`,
      "- section_title: Introduction",
      "- section_slug: introduction",
      "",
      "Injected source section for writing e2e.",
      "",
    ].join("\n");

  await Promise.all([
    fs.writeFile(
      path.join(root, paper01RelativePath),
      sourceSectionMarkdown("Dry Run Exemplar 1A", "dryrun1"),
      "utf-8",
    ),
    fs.writeFile(
      path.join(root, paper02RelativePath),
      sourceSectionMarkdown("Dry Run Exemplar 1B", "dryrun2"),
      "utf-8",
    ),
    fs.writeFile(
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
        `- source_section_path: ${paper02RelativePath}`,
        "  - citation_key: dryrun2",
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
    ),
  ]);
}

async function collectFilesNamed(root: string, fileName: string): Promise<string[]> {
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
        if (entry.name === fileName) {
          matches.push(path.relative(root, absolutePath).replace(/\\/g, "/"));
        }
      }),
    );
  }
  await walk(root);
  return matches.sort();
}

describe("research run e2e", () => {
  const createdDirs: string[] = [];
  const originalArgv = process.argv.slice();

  beforeEach(() => {
    process.argv = ["openclaw", "research", "run"];
  });

  afterEach(async () => {
    process.argv = originalArgv.slice();
    vi.restoreAllMocks();
    await Promise.all(
      createdDirs.splice(0).map(async (dir) => await fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("writes a dry-run bundle through the built CLI program", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-research-e2e-"));
    createdDirs.push(root);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const fixedNow = new Date("2026-03-16T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    try {
      const program = buildProgram();
      await program.parseAsync(
        [
          "research",
          "run",
          "--idea",
          "multi-report generation for downstream agent execution",
          "--count",
          "4",
          "--out",
          root,
          "--dry-run",
        ],
        { from: "user" },
      );
    } finally {
      vi.useRealTimers();
    }

    const ideaMd = await fs.readFile(path.join(root, "idea.md"), "utf-8");
    const specificationMd = await fs.readFile(path.join(root, "specification.md"), "utf-8");
    const layoutMd = await fs.readFile(path.join(root, "layout.md"), "utf-8");
    const literatureReviewMd = await fs.readFile(path.join(root, "literature_review.md"), "utf-8");
    const referencesBib = await fs.readFile(path.join(root, "references.bib"), "utf-8");
    const todoMd = await fs.readFile(path.join(root, "todo.md"), "utf-8");
    const introductionCitations = await fs.readFile(
      path.join(root, "section_materials", "introduction", "citations.md"),
      "utf-8",
    );
    const workspaceAgents = await fs.readFile(path.join(root, "AGENTS.md"), "utf-8");
    const writingAgent = await fs.readFile(path.join(root, "agents", "writing", "AGENTS.md"), "utf-8");
    const taskPlan = await fs.readFile(path.join(root, "tasks", "T01", "plan.md"), "utf-8");
    const runtimeEntries = await fs.readdir(path.join(root, "runtime"));

    expect(ideaMd).toContain("# 研究想法");
    expect(ideaMd).toContain("## 问题定义");
    expect(specificationMd).toContain("# 研究规范");
    expect(layoutMd).toContain("# 落盘约定");
    expect(literatureReviewMd).toContain("## introduction");
    expect(referencesBib).toContain("@inproceedings{");
    expect(introductionCitations).toContain("# introduction 引用候选");
    expect(todoMd).toContain("task_01 — **coding** — Finalize the exact research question");
    expect(workspaceAgents).toContain("workspace 是唯一真源");
    expect(workspaceAgents).toContain("每一轮只能选择一个 next action");
    expect(workspaceAgents).toContain("Writing 总是按 `layout.md` 与当前任务 `Section Queue` 逐 section 派发");
    expect(writingAgent).toContain("使用 LaTeX 产出并修改目标 section");
    expect(writingAgent).toContain("一次只写一个 section");
    expect(taskPlan).toContain("## Step List");
    expect(taskPlan).toContain("### S01");
    expect(runtimeEntries).toContain("dispatch_log.md");
    expect(runtimeEntries).toContain("session_notes.md");
    expect(await fs.stat(path.join(root, "section_materials", "introduction", "papers"))).toBeTruthy();
    await expect(fs.stat(path.join(root, "paper"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(consoleLog).toHaveBeenCalled();
  });

  it("runs the minimal closed loop through the built CLI program", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-research-tick-e2e-"));
    createdDirs.push(root);
    const binDir = path.join(root, "bin");
    await fs.mkdir(binDir, { recursive: true });
    await createManuscriptTemplate(root);

    const codexPath = path.join(binDir, "codex");
    await fs.writeFile(
      codexPath,
      `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd ../.. && pwd)"
ROLE="$(basename "$PWD")"
if [[ "$ROLE" == "step_planner" ]]; then
  COUNT_FILE="$ROOT/.step_planner_count"
  COUNT="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  COUNT=$((COUNT + 1))
  printf '%s' "$COUNT" >"$COUNT_FILE"
  if [[ "$COUNT" == "1" ]]; then
    cat >"$ROOT/tasks/T01/plan.md" <<'EOF'
# T01 Finalize the exact research question

## Worker Type
coding

## 状态
pending

## 目标
锁定研究问题、基线和边界。

## 验收标准
- Question statement is fixed
- Baseline is named

## Step List

### S01
- status: pending
- task: 整理一版研究问题表述
- acceptance: 研究问题表述已写清楚

## Blockers
- 暂无

## 最近执行结果
- Step Planner 已补齐当前任务计划。

## Next Action Hint
- 从 S01 开始。
EOF
    cat <<'EOF'
RESULT: done
SUMMARY: 已把当前任务整理成可执行状态。
PLAN_UPDATE: 已补齐 tasks/T01/plan.md。
NEXT_HINT: 进入 coding。
EOF
  else
    cat >"$ROOT/tasks/T01/plan.md" <<'EOF'
# T01 Finalize the exact research question

## Worker Type
coding

## 状态
in_progress

## 目标
锁定研究问题、基线和边界。

## 验收标准
- Question statement is fixed
- Baseline is named

## Step List

### S01
- status: pending
- task: 只保留一个已核实 baseline，缩小首个实现范围
- acceptance: 研究问题与 baseline 范围已缩小并写清

## Blockers
- 暂无

## 最近执行结果
- Step Planner 已归档旧计划并写出新计划。

## Next Action Hint
- 重新执行 coding。
EOF
    cat <<'EOF'
RESULT: done
SUMMARY: 已归档旧计划并完成重规划。
PLAN_UPDATE: 已重写 tasks/T01/plan.md。
NEXT_HINT: 重新进入 coding。
EOF
  fi
elif [[ "$ROLE" == "coding" ]]; then
  COUNT_FILE="$ROOT/.coding_count"
  COUNT="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
  COUNT=$((COUNT + 1))
  printf '%s' "$COUNT" >"$COUNT_FILE"
  if [[ "$COUNT" == "1" ]]; then
    cat >"$ROOT/tasks/T01/plan.md" <<'EOF'
# T01 Finalize the exact research question

## Worker Type
coding

## 状态
in_progress

## 目标
锁定研究问题、基线和边界。

## 验收标准
- Question statement is fixed
- Baseline is named

## Step List

### S01
- status: in_progress
- task: 整理一版研究问题表述
- acceptance: 研究问题表述已写清楚

## Blockers
- 缺少 baseline 证据，当前 coding 路径失败。

## 最近执行结果
- Coding Agent 遇到 blocker，需要回到 Step Planner。

## Next Action Hint
- 回到 Step Planner 缩小步骤。
EOF
    cat >"$ROOT/tasks/T01/summary.md" <<'EOF'
# Summary

- 首轮 coding 因 baseline 证据不足失败。
EOF
    cat >"$ROOT/tasks/T01/outputs/result.json" <<'EOF'
{
  "task_id": "T01",
  "success": false,
  "command": "codex coding",
  "metrics": {
    "status": "blocked"
  },
  "output_paths": [
    "tasks/T01/plan.md"
  ]
}
EOF
    printf '%s\\n' '[blocked] baseline evidence missing' >>"$ROOT/tasks/T01/logs/run.log"
    cat <<'EOF'
RESULT: blocked
SUMMARY: baseline 证据不足，coding 失败。
PLAN_UPDATE: 已把 blocker 写回 tasks/T01/plan.md。
NEXT_HINT: 回到 Step Planner。
EOF
  else
    cat >"$ROOT/tasks/T01/plan.md" <<'EOF'
# T01 Finalize the exact research question

## Worker Type
coding

## 状态
done

## 目标
Lock the primary question, baseline, and scope boundary.

## 验收标准
- Question statement is fixed
- Baseline is named
- Out-of-scope items are listed

## Step List

### S01
- status: done
- task: 只保留一个已核实 baseline，缩小首个实现范围
- acceptance: Question statement is fixed

## Blockers
- 暂无

## 最近执行结果
- Coding Agent 已完成缩小后的首个步骤。

## Next Action Hint
- 转到下一个顶层任务。
EOF
    cat >"$ROOT/tasks/T01/summary.md" <<'EOF'
# Summary

- Coding Agent 已完成缩小后的首个步骤。
EOF
    cat >"$ROOT/tasks/T01/outputs/result.json" <<'EOF'
{
  "task_id": "T01",
  "success": true,
  "command": "codex coding",
  "metrics": {
    "status": "done"
  },
  "output_paths": [
    "tasks/T01/plan.md",
    "tasks/T01/summary.md"
  ]
}
EOF
    printf '%s\\n' '[done] narrowed scope completed' >>"$ROOT/tasks/T01/logs/run.log"
    cat <<'EOF'
RESULT: done
SUMMARY: 已完成缩小后的 coding 步骤。
PLAN_UPDATE: 已把 S01 标记为 done。
NEXT_HINT: 转到下一个顶层任务。
EOF
  fi
elif [[ "$ROLE" == "writing" ]]; then
  cat >"$ROOT/tasks/T05/plan.md" <<'EOF'
# T05 Finalize the section-level manuscript content

## Worker Type
writing

## 状态
in_progress

## 目标
Draft the section-level manuscript content.

## 验收标准
- Writing inputs are aligned

## Section Queue

### W01
- status: done
- section_id: S01
- section_slug: introduction
- materials_dir: section_materials/introduction/
- manuscript_path: manuscript/sections/introduction.tex
- acceptance: introduction saved as LaTeX and cites valid keys

## Blockers
- 暂无

## 最近执行结果
- Writing Agent 已完成首个 section。

## Next Action Hint
- 转到下一个 writing 任务。
EOF
  cat >"$ROOT/manuscript/sections/introduction.tex" <<'EOF'
\\section{Introduction}
The workflow writes section-level LaTeX with valid citations \\cite{dryrun1,dryrun2}.
EOF
  cat <<'EOF'
RESULT: done
SUMMARY: 已完成 introduction.tex。
PLAN_UPDATE: 已把 W01 标记为 done。
NEXT_HINT: 转到下一个 writing 任务。
EOF
else
  cat <<'EOF'
RESULT: done
SUMMARY: noop
PLAN_UPDATE: none
NEXT_HINT: none
EOF
fi
`,
      { encoding: "utf-8", mode: 0o755 },
    );

    const program = buildProgram();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const fixedNow = new Date("2026-03-16T11:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    try {
      await program.parseAsync(
        [
          "research",
          "run",
          "--idea",
          "multi-report generation for downstream agent execution",
          "--out",
          root,
          "--dry-run",
        ],
        { from: "user" },
      );
      await fs.rm(path.join(root, "tasks", "T01", "plan.md"));

      const originalPath = process.env.PATH ?? "";
      process.env.PATH = `${binDir}:${originalPath}`;
      try {
        await program.parseAsync(["research", "tick", "--workspace", root, "--json"], {
          from: "user",
        });
        await program.parseAsync(["research", "tick", "--workspace", root, "--json"], {
          from: "user",
        });
        await program.parseAsync(["research", "tick", "--workspace", root, "--json"], {
          from: "user",
        });
        await program.parseAsync(["research", "tick", "--workspace", root, "--json"], {
          from: "user",
        });
        await Promise.all([
          markTaskPlanDone(root, "T02"),
          markTaskPlanDone(root, "T03"),
          markTaskPlanDone(root, "T04"),
          markTaskPlanDone(root, "T06"),
          prepareIntroductionWritingMaterials(root),
        ]);
        await program.parseAsync(["research", "tick", "--workspace", root, "--json"], {
          from: "user",
        });
      } finally {
        process.env.PATH = originalPath;
      }
    } finally {
      vi.useRealTimers();
    }

    const todoMd = await fs.readFile(path.join(root, "todo.md"), "utf-8");
    const taskMd = await fs.readFile(path.join(root, "tasks", "T01", "plan.md"), "utf-8");
    const introTex = await fs.readFile(
      path.join(root, "manuscript", "sections", "introduction.tex"),
      "utf-8",
    );
    const historyEntries = await fs.readdir(path.join(root, "tasks", "T01", "history"));
    const statusFiles = await collectFilesNamed(root, "status.json");
    const state = JSON.parse(await fs.readFile(path.join(root, "state.json"), "utf-8")) as {
      activeTaskId?: string;
      lastRole?: string;
    };

    expect(todoMd).toContain("task_01 — **coding** — Finalize the exact research question");
    expect(taskMd).toContain("Coding Agent 已完成缩小后的首个步骤。");
    expect(introTex).toContain("\\cite{dryrun1,dryrun2}");
    expect(historyEntries).toHaveLength(1);
    expect(statusFiles).toEqual([]);
    expect(state.activeTaskId).toBe("T05");
    expect(state.lastRole).toBe("writing_agent");
    expect(consoleLog).toHaveBeenCalled();
  });
});
