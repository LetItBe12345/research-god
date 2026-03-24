import { describe, expect, it } from "vitest";
import {
  renderFallbackLiteratureReviewMarkdown,
  renderExemplarMetaMarkdown,
  renderLiteratureReviewMarkdown,
  renderParsedTaskPlanMarkdown,
  renderRoleAgentsMarkdown,
  renderSectionBriefMarkdown,
  renderSectionCitationsMarkdown,
  renderTaskPlanMarkdown,
  renderTopLevelTodoMarkdown,
  renderWorkspaceAgentsMarkdown,
} from "./render.js";

describe("research render helpers", () => {
  it("renders section citation markdown with references-first boundary notes", () => {
    const markdown = renderSectionCitationsMarkdown("introduction", [
      {
        title: "Alpha",
        citationKey: "alpha2026",
        summary: "Alpha summary.",
      },
    ]);

    expect(markdown).toContain("corpus_role: references");
    expect(markdown).toContain("authority_bib: ../../references.bib");
    expect(markdown).toContain("style_materials: ./papers/");
    expect(markdown).toContain("- cite_key: alpha2026");
    expect(markdown).toContain("- summary: Alpha summary.");
  });

  it("treats literature review as optional and keeps fallback rendering separate", () => {
    expect(renderLiteratureReviewMarkdown()).toBeUndefined();
    expect(
      renderFallbackLiteratureReviewMarkdown([
        {
          section: "related-work",
          entries: [{ title: "Alpha", citationKey: "alpha2026", summary: "Alpha summary." }],
        },
      ]),
    ).toContain("## related-work");
  });

  it("tells writing agents to separate references from exemplar papers", () => {
    const prompt = renderRoleAgentsMarkdown("writing_agent");

    expect(prompt).toContain("使用 LaTeX 产出并修改目标 section");
    expect(prompt).toContain("一次只写一个 section");
    expect(prompt).toContain("必须先读取 `agents/writing/AGENTS.md` 与当前 section task package");
    expect(prompt).toContain("只有在 `brief.md` / task package 显式声明时");
    expect(prompt).toContain("先核对根级 `references.bib`，再读取当前 section 下的待引用 Markdown");
    expect(prompt).toContain("`papers/` 与 `source_sections/` 只用于学习写作风格和 section 组织");
    expect(prompt).toContain("不允许跨 section 发散");
  });

  it("keeps root AGENTS focused on long-term orchestration rules", () => {
    const markdown = renderWorkspaceAgentsMarkdown();

    expect(markdown).toContain("workspace 是唯一真源");
    expect(markdown).toContain("每一轮只能选择一个 next action");
    expect(markdown).toContain("Writing 总是按 `layout.md` 与当前任务 `Section Queue` 逐 section 派发");
    expect(markdown).toContain("必须显式注入当前 section 的材料合同");
    expect(markdown).toContain("主会话不要假设自己会自动注入这些文件");
  });

  it("renders exemplar meta markdown with the required fields", () => {
    const markdown = renderExemplarMetaMarkdown({
      paperId: "paper_01",
      paper: {
        citationKey: "alpha2026",
        title: "Alpha",
        pdfUrl: "[待核实] alpha pdf",
        shortIntro: "Short alpha exemplar.",
        whyRelevant: "Fits the introduction structure.",
      },
    });

    expect(markdown).toContain("- citation_key: alpha2026");
    expect(markdown).toContain("- title: Alpha");
    expect(markdown).toContain("- pdf_url: [待核实] alpha pdf");
    expect(markdown).toContain("- short_intro: Short alpha exemplar.");
    expect(markdown).toContain("- why_relevant: Fits the introduction structure.");
  });

  it("renders section brief markdown with source section mappings", () => {
    const markdown = renderSectionBriefMarkdown({
      sectionId: "S01",
      sectionTitle: "introduction",
      writingGoal: "State the problem and contribution.",
      keyPoints: ["State the motivation", "List the contributions"],
      questionsToAnswer: ["Why does the problem matter?"],
      avoidPatterns: ["Do not turn this into related work."],
      latexOutputPath: "manuscript/sections/introduction.tex",
      sourceSections: [
        {
          paperId: "paper_01",
          citationKey: "alpha2026",
          sectionTitle: "Introduction",
          sectionSlug: "introduction",
          relativePath:
            "section_materials/introduction/papers/paper_01/source_sections/02-introduction.md",
          selectionReason: "matched introduction section semantics from paper_01",
        },
      ],
      referencesBibPath: "references.bib",
      literatureReviewPath: "literature_review.md",
      experimentResultPaths: ["tasks/*/outputs/result.json"],
      existingTexPaths: ["manuscript/sections/introduction.tex"],
    });

    expect(markdown).toContain("- section_id: S01");
    expect(markdown).toContain("- writing_goal: State the problem and contribution.");
    expect(markdown).toContain("## Must Cover");
    expect(markdown).toContain("- State the motivation");
    expect(markdown).toContain("- latex_output_path: manuscript/sections/introduction.tex");
    expect(markdown).toContain(
      "- source_section_path: section_materials/introduction/papers/paper_01/source_sections/02-introduction.md",
    );
    expect(markdown).toContain("citation_key: alpha2026");
    expect(markdown).toContain("- references_bib: references.bib");
  });

  it("renders top-level todo with explicit worker types and coding-first ordering", () => {
    const markdown = renderTopLevelTodoMarkdown([
      {
        id: "T01",
        title: "Lock the benchmark scope",
        workerType: "coding",
        objective: "Fix the benchmark.",
        acceptance: ["Benchmark scope is fixed"],
        status: "done",
        subtasksDir: "tasks/T01/",
      },
      {
        id: "T02",
        title: "Prepare the first experiment run",
        workerType: "coding",
        objective: "Run the first slice.",
        acceptance: ["First run exists"],
        status: "pending",
        subtasksDir: "tasks/T02/",
      },
      {
        id: "T03",
        title: "Stabilize evaluation scripts",
        workerType: "coding",
        objective: "Keep eval reproducible.",
        acceptance: ["Eval is stable"],
        status: "pending",
        subtasksDir: "tasks/T03/",
      },
      {
        id: "T04",
        title: "Collect final ablations",
        workerType: "coding",
        objective: "Run ablations.",
        acceptance: ["Ablations exist"],
        status: "pending",
        subtasksDir: "tasks/T04/",
      },
      {
        id: "T05",
        title: "Draft the section manuscript",
        workerType: "writing",
        objective: "Write sections.",
        acceptance: ["Draft exists"],
        status: "pending",
        subtasksDir: "tasks/T05/",
      },
      {
        id: "T06",
        title: "Polish the final LaTeX package",
        workerType: "writing",
        objective: "Prepare final paper.",
        acceptance: ["LaTeX package is ready"],
        status: "pending",
        subtasksDir: "tasks/T06/",
      },
    ]);

    expect(markdown).toContain("# Todo");
    expect(markdown).toContain("仅保留项目级大项");
    expect(markdown).toContain(
      "- [x] task_01 — **coding** — Lock the benchmark scope (`tasks/T01/`)",
    );
    expect(markdown).toContain(
      "- [ ] task_05 — **writing** — Draft the section manuscript (`tasks/T05/`)",
    );
  });

  it("renders coding task plans with a structured step list", () => {
    const markdown = renderTaskPlanMarkdown({
      id: "T01",
      title: "Lock scope",
      workerType: "coding",
      objective: "Lock the experiment scope.",
      acceptance: ["Scope is frozen"],
      status: "pending",
      subtasksDir: "tasks/T01/",
    });

    expect(markdown).toContain("## Step List");
    expect(markdown).toContain("### S01");
    expect(markdown).toContain("- task: Lock the experiment scope.");
    expect(markdown).toContain("## Blockers");
    expect(markdown).toContain("## 最近执行结果");
    expect(markdown).toContain("## Next Action Hint");
  });

  it("renders writing plans from layout-driven section queue", () => {
    const markdown = renderTaskPlanMarkdown(
      {
        id: "T05",
        title: "Draft manuscript",
        workerType: "writing",
        objective: "Write the manuscript in fixed order.",
        acceptance: ["All sections drafted"],
        status: "pending",
        subtasksDir: "tasks/T05/",
      },
      [
        {
          id: "S01",
          slug: "abstract",
          materialsDir: "section_materials/abstract/",
          citationsFile: "section_materials/abstract/citations.md",
          briefFile: "section_materials/abstract/brief.md",
          manuscriptTex: "manuscript/sections/abstract.tex",
        },
      ],
    );

    expect(markdown).toContain("## Section Queue");
    expect(markdown).toContain("- section_id: S01");
    expect(markdown).toContain("- materials_dir: section_materials/abstract/");
    expect(markdown).toContain("- manuscript_path: manuscript/sections/abstract.tex");
  });

  it("renders parsed plans back into structured markdown", () => {
    const markdown = renderParsedTaskPlanMarkdown({
      id: "T06",
      title: "Draft manuscript",
      workerType: "writing",
      status: "in_progress",
      objective: "Write the manuscript in fixed order.",
      acceptance: ["All sections drafted"],
      steps: [],
      sectionQueue: [
        {
          id: "W01",
          status: "done",
          sectionId: "S01",
          sectionSlug: "abstract",
          materialsDir: "section_materials/abstract/",
          manuscriptPath: "manuscript/sections/abstract.tex",
          acceptance: "Finish abstract draft.",
        },
      ],
      blockers: ["暂无"],
      lastRunResult: "Abstract draft updated.",
      nextActionHint: "Move to introduction next.",
      dir: "tasks/T06",
      path: "tasks/T06/plan.md",
    });

    expect(markdown).toContain("### W01");
    expect(markdown).toContain("- status: done");
    expect(markdown).toContain("- Abstract draft updated.");
    expect(markdown).toContain("- Move to introduction next.");
  });
});
