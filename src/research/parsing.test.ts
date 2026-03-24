import { describe, expect, it } from "vitest";
import {
  parseLayoutMarkdown,
  parsePaperTextOutput,
  parseSourceSectionMarkdown,
  parseTaskPlanMarkdown,
  parseTopLevelTodoMarkdown,
  parseWorkerStdoutBrief,
} from "./parsing.js";

describe("parseWorkerStdoutBrief", () => {
  it("parses the minimal stdout contract with thin field extraction", () => {
    const parsed = parseWorkerStdoutBrief(
      [
        "RESULT: blocked",
        "SUMMARY: baseline run hit missing checkpoint",
        "PLAN_UPDATE: Updated S01 notes and recorded the blocker in plan.md.",
        "NEXT_HINT: Replan around the unavailable checkpoint.",
      ].join("\n"),
    );

    expect(parsed).toEqual({
      result: "blocked",
      summary: "baseline run hit missing checkpoint",
      planUpdate: "Updated S01 notes and recorded the blocker in plan.md.",
      nextHint: "Replan around the unavailable checkpoint.",
    });
  });

  it("rejects stdout that omits required brief fields", () => {
    expect(() =>
      parseWorkerStdoutBrief(
        [
          "RESULT: done",
          "SUMMARY: implemented the patch",
          "NEXT_HINT: verify on the full dataset",
        ].join("\n"),
      ),
    ).toThrow(/PLAN_UPDATE/);
  });
});

describe("parsePaperTextOutput", () => {
  it("keeps only citeable BibTeX entries and normalizes cite keys", () => {
    const parsed = parsePaperTextOutput(
      [
        "===BIB===",
        "These notes should not land in references.bib.",
        "@inproceedings{alpha2026,",
        "  title = {Alpha},",
        "  author = {A},",
        "  year = {2026},",
        "}",
        "",
        "Comment between entries.",
        "@article{beta2025,",
        "  title = {Beta},",
        "  author = {B},",
        "  year = {2025},",
        "}",
        "",
        "===PAPERS===",
        "## introduction",
        "",
        "### Alpha",
        "\\cite{alpha2026}",
        "",
        "Intro summary.",
        "",
        "## method",
        "",
        "### Beta",
        "beta2025",
        "",
        "Method summary.",
        "",
        "===EXEMPLARS===",
        "## introduction",
        "",
        "### Alpha",
        "- citation_key: alpha2026",
        "- pdf_url: https://example.com/alpha.pdf",
        "- short_intro: Short alpha exemplar.",
        "- why_relevant: Frames the introduction clearly.",
        "",
        "### Beta",
        "- citation_key: beta2025",
        "- pdf_url: [待核实] beta pdf",
        "- short_intro: Short beta exemplar.",
        "- why_relevant: Complements the first exemplar with another intro pattern.",
        "",
        "## method",
        "",
        "### Beta",
        "- citation_key: beta2025",
        "- pdf_url: https://example.com/beta.pdf",
        "- short_intro: Short beta method exemplar.",
        "- why_relevant: Shows a compact method section organization.",
        "",
        "### Alpha",
        "- citation_key: alpha2026",
        "- pdf_url: https://example.com/alpha-method.pdf",
        "- short_intro: Short alpha method exemplar.",
        "- why_relevant: Offers a second method-writing pattern.",
      ].join("\n"),
    );

    expect(parsed.bib).toContain("@inproceedings{alpha2026,");
    expect(parsed.bib).toContain("@article{beta2025,");
    expect(parsed.bib).not.toContain("These notes should not land");
    expect(parsed.bibEntryKeys).toEqual(["alpha2026", "beta2025"]);
    expect(parsed.sectionCitations[0]?.entries[0]?.citationKey).toBe("alpha2026");
    expect(parsed.sectionExemplars[0]?.papers).toHaveLength(2);
    expect(parsed.sectionExemplars[0]?.papers[0]?.pdfUrl).toBe("https://example.com/alpha.pdf");
    expect(parsed.literatureReviewMarkdown).toBeUndefined();
  });

  it("rejects section citations that are missing from references.bib", () => {
    expect(() =>
      parsePaperTextOutput(
        [
          "===BIB===",
          "@inproceedings{alpha2026,",
          "  title = {Alpha},",
          "  author = {A},",
          "  year = {2026},",
          "}",
          "",
          "===PAPERS===",
          "## introduction",
          "",
          "### Missing",
          "missing2026",
          "",
          "Missing summary.",
          "",
          "===EXEMPLARS===",
          "## introduction",
          "",
          "### Missing",
          "- citation_key: missing2026",
          "- pdf_url: [待核实] missing",
          "- short_intro: Missing exemplar.",
          "- why_relevant: Missing from bib on purpose.",
          "",
          "### Alpha",
          "- citation_key: alpha2026",
          "- pdf_url: https://example.com/alpha.pdf",
          "- short_intro: Alpha exemplar.",
          "- why_relevant: Second exemplar.",
        ].join("\n"),
      ),
    ).toThrow(/missing from BibTeX/);
  });

  it("rejects exemplar short_intro values that are too long", () => {
    expect(() =>
      parsePaperTextOutput(
        [
          "===BIB===",
          "@inproceedings{alpha2026,",
          "  title = {Alpha},",
          "  author = {A},",
          "  year = {2026},",
          "}",
          "@article{beta2025,",
          "  title = {Beta},",
          "  author = {B},",
          "  year = {2025},",
          "}",
          "",
          "===PAPERS===",
          "## introduction",
          "",
          "### Alpha",
          "alpha2026",
          "",
          "Intro summary.",
          "",
          "===EXEMPLARS===",
          "## introduction",
          "",
          "### Alpha",
          "- citation_key: alpha2026",
          "- pdf_url: https://example.com/alpha.pdf",
          "- short_intro: This intro is far too long because it keeps describing multiple details and clauses until it clearly exceeds the intended short sentence limit for exemplar metadata.",
          "- why_relevant: Good introduction framing.",
          "",
          "### Beta",
          "- citation_key: beta2025",
          "- pdf_url: https://example.com/beta.pdf",
          "- short_intro: Short beta exemplar.",
          "- why_relevant: Backup introduction pattern.",
        ].join("\n"),
      ),
    ).toThrow(/short_intro/);
  });

  it("parses source section markdown metadata for brief mapping", () => {
    const parsed = parseSourceSectionMarkdown(
      [
        "# Introduction",
        "",
        "- paper_title: Alpha",
        "- citation_key: alpha2026",
        "- section_title: Introduction",
        "- section_slug: introduction",
        "",
        "Body",
      ].join("\n"),
    );

    expect(parsed.citationKey).toBe("alpha2026");
    expect(parsed.sectionTitle).toBe("Introduction");
    expect(parsed.sectionSlug).toBe("introduction");
  });
});

describe("parseTopLevelTodoMarkdown", () => {
  it("parses explicit coding and writing worker types from the top-level todo", () => {
    const parsed = parseTopLevelTodoMarkdown(
      [
        "# Todo",
        "",
        "> 仅保留项目级大项；细化步骤与逐轮执行记录不写在这里。",
        "> 每个大项映射一个 task 目录；后续细则应下沉到对应 task 的 `plan.md`。",
        "",
        "- [x] task_01 — **coding** — Lock the benchmark scope (`tasks/T01/`)",
        "- [ ] task_02 — **coding** — Prepare the data slice (`tasks/T02/`)",
        "- [ ] task_03 — **coding** — Run the baseline experiment (`tasks/T03/`)",
        "- [ ] task_04 — **coding** — Collect the final evaluation (`tasks/T04/`)",
        "- [ ] task_05 — **writing** — Draft the main sections (`tasks/T05/`)",
        "- [ ] task_06 — **writing** — Polish final LaTeX delivery (`tasks/T06/`)",
      ].join("\n"),
    );

    expect(parsed).toHaveLength(6);
    expect(parsed[0]).toMatchObject({
      id: "T01",
      workerType: "coding",
      status: "done",
      subtasksDir: "tasks/T01/",
    });
    expect(parsed[4]).toMatchObject({
      id: "T05",
      workerType: "writing",
      status: "pending",
      subtasksDir: "tasks/T05/",
    });
  });

  it("rejects top-level todos outside the 6-10 item boundary", () => {
    expect(() =>
      parseTopLevelTodoMarkdown(
        [
          "# Todo",
          "",
          "- [ ] task_01 — **coding** — One (`tasks/T01/`)",
          "- [ ] task_02 — **coding** — Two (`tasks/T02/`)",
          "- [ ] task_03 — **coding** — Three (`tasks/T03/`)",
          "- [ ] task_04 — **coding** — Four (`tasks/T04/`)",
          "- [ ] task_05 — **writing** — Five (`tasks/T05/`)",
        ].join("\n"),
      ),
    ).toThrow(/6 to 10/);
  });

  it("rejects coding tasks that appear after writing tasks", () => {
    expect(() =>
      parseTopLevelTodoMarkdown(
        [
          "# Todo",
          "",
          "- [ ] task_01 — **coding** — One (`tasks/T01/`)",
          "- [ ] task_02 — **writing** — Two (`tasks/T02/`)",
          "- [ ] task_03 — **coding** — Three (`tasks/T03/`)",
          "- [ ] task_04 — **coding** — Four (`tasks/T04/`)",
          "- [ ] task_05 — **writing** — Five (`tasks/T05/`)",
          "- [ ] task_06 — **writing** — Six (`tasks/T06/`)",
        ].join("\n"),
      ),
    ).toThrow(/coding tasks before writing tasks/);
  });
});

describe("parseLayoutMarkdown", () => {
  it("parses layout sections in fixed order", () => {
    const parsed = parseLayoutMarkdown(
      [
        "# 落盘约定",
        "",
        "## Section Layout",
        "",
        "### S01 abstract",
        "",
        "- section_slug: abstract",
        "- materials_dir: section_materials/abstract/",
        "- citations_file: section_materials/abstract/citations.md",
        "- brief_file: section_materials/abstract/brief.md",
        "- manuscript_tex: manuscript/sections/abstract.tex",
        "",
        "### S02 introduction",
        "",
        "- section_slug: introduction",
        "- materials_dir: section_materials/introduction/",
        "- citations_file: section_materials/introduction/citations.md",
        "- brief_file: section_materials/introduction/brief.md",
        "- manuscript_tex: manuscript/sections/introduction.tex",
      ].join("\n"),
    );

    expect(parsed.map((section) => section.id)).toEqual(["S01", "S02"]);
    expect(parsed[0]?.manuscriptTex).toBe("manuscript/sections/abstract.tex");
  });
});

describe("parseTaskPlanMarkdown", () => {
  const layoutMarkdown = [
    "# 落盘约定",
    "",
    "## Section Layout",
    "",
    "### S01 abstract",
    "",
    "- section_slug: abstract",
    "- materials_dir: section_materials/abstract/",
    "- citations_file: section_materials/abstract/citations.md",
    "- brief_file: section_materials/abstract/brief.md",
    "- manuscript_tex: manuscript/sections/abstract.tex",
    "",
    "### S02 introduction",
    "",
    "- section_slug: introduction",
    "- materials_dir: section_materials/introduction/",
    "- citations_file: section_materials/introduction/citations.md",
    "- brief_file: section_materials/introduction/brief.md",
    "- manuscript_tex: manuscript/sections/introduction.tex",
  ].join("\n");

  it("reads structured step list plans for coding tasks", () => {
    const parsed = parseTaskPlanMarkdown({
      content: [
        "# T05 Draft the main sections",
        "",
        "## Worker Type",
        "coding",
        "",
        "## 状态",
        "pending",
        "",
        "## 目标",
        "Write the manuscript sections.",
        "",
        "## 验收标准",
        "- Draft exists",
        "",
        "## Step List",
        "",
        "### S01",
        "- status: pending",
        "- task: Write the first implementation slice.",
        "- acceptance: Draft exists",
        "",
        "## Blockers",
        "- 暂无",
        "",
        "## 最近执行结果",
        "- 暂无",
        "",
        "## Next Action Hint",
        "- Start from S01.",
      ].join("\n"),
      taskDir: "tasks/T05",
      taskPath: "tasks/T05/plan.md",
    });

    expect(parsed.workerType).toBe("coding");
    expect(parsed.id).toBe("T05");
    expect(parsed.steps[0]).toMatchObject({
      id: "S01",
      task: "Write the first implementation slice.",
      acceptance: "Draft exists",
    });
  });

  it("parses writing section queue and enforces layout order", () => {
    const parsed = parseTaskPlanMarkdown({
      content: [
        "# T06 Draft the manuscript",
        "",
        "## Worker Type",
        "writing",
        "",
        "## 状态",
        "pending",
        "",
        "## 目标",
        "Write the paper sections in fixed order.",
        "",
        "## 验收标准",
        "- All sections drafted",
        "",
        "## Section Queue",
        "",
        "### W01",
        "- status: pending",
        "- section_id: S01",
        "- section_slug: abstract",
        "- materials_dir: section_materials/abstract/",
        "- manuscript_path: manuscript/sections/abstract.tex",
        "- acceptance: Finish abstract draft.",
        "",
        "### W02",
        "- status: pending",
        "- section_id: S02",
        "- section_slug: introduction",
        "- materials_dir: section_materials/introduction/",
        "- manuscript_path: manuscript/sections/introduction.tex",
        "- acceptance: Finish introduction draft.",
        "",
        "## Blockers",
        "- 暂无",
        "",
        "## 最近执行结果",
        "- 暂无",
        "",
        "## Next Action Hint",
        "- Start from W01.",
      ].join("\n"),
      taskDir: "tasks/T06",
      taskPath: "tasks/T06/plan.md",
      layoutContent: layoutMarkdown,
    });

    expect(parsed.sectionQueue.map((item) => item.sectionSlug)).toEqual(["abstract", "introduction"]);
    expect(parsed.sectionQueue[0]?.manuscriptPath).toBe("manuscript/sections/abstract.tex");
  });

  it("fails when required step fields are missing", () => {
    expect(() =>
      parseTaskPlanMarkdown({
        content: [
          "# T01 Broken coding plan",
          "",
          "## Worker Type",
          "coding",
          "",
          "## 状态",
          "pending",
          "",
          "## 目标",
          "Broken.",
          "",
          "## 验收标准",
          "- ok",
          "",
          "## Step List",
          "",
          "### S01",
          "- status: pending",
          "- task: Missing acceptance field",
          "",
          "## Blockers",
          "- 暂无",
          "",
          "## 最近执行结果",
          "- 暂无",
          "",
          "## Next Action Hint",
          "- Start.",
        ].join("\n"),
        taskDir: "tasks/T01",
        taskPath: "tasks/T01/plan.md",
      }),
    ).toThrow(/missing required fields/i);
  });

  it("fails when required queue fields are missing", () => {
    expect(() =>
      parseTaskPlanMarkdown({
        content: [
          "# T06 Broken writing plan",
          "",
          "## Worker Type",
          "writing",
          "",
          "## 状态",
          "pending",
          "",
          "## 目标",
          "Broken.",
          "",
          "## 验收标准",
          "- ok",
          "",
          "## Section Queue",
          "",
          "### W01",
          "- status: pending",
          "- section_id: S01",
          "- section_slug: abstract",
          "- materials_dir: section_materials/abstract/",
          "- acceptance: Missing manuscript path",
          "",
          "## Blockers",
          "- 暂无",
          "",
          "## 最近执行结果",
          "- 暂无",
          "",
          "## Next Action Hint",
          "- Start.",
        ].join("\n"),
        taskDir: "tasks/T06",
        taskPath: "tasks/T06/plan.md",
        layoutContent: layoutMarkdown,
      }),
    ).toThrow(/missing required fields/i);
  });

  it("rejects empty or prose-only plans", () => {
    expect(() =>
      parseTaskPlanMarkdown({
        content: "# T01 Empty",
        taskDir: "tasks/T01",
        taskPath: "tasks/T01/plan.md",
      }),
    ).toThrow();

    expect(() =>
      parseTaskPlanMarkdown({
        content: [
          "# T01 Prose plan",
          "",
          "## Worker Type",
          "coding",
          "",
          "## 状态",
          "pending",
          "",
          "## 目标",
          "This plan is prose only.",
          "",
          "## 验收标准",
          "- ok",
          "",
          "## Step List",
          "",
          "Please implement the parser and renderer soon.",
          "",
          "## Blockers",
          "- 暂无",
          "",
          "## 最近执行结果",
          "- 暂无",
          "",
          "## Next Action Hint",
          "- Start.",
        ].join("\n"),
        taskDir: "tasks/T01",
        taskPath: "tasks/T01/plan.md",
      }),
    ).toThrow(/must not contain prose|must include a non-empty Step List/i);
  });

  it("rejects 最近执行结果 that contains multiple sentences", () => {
    expect(() =>
      parseTaskPlanMarkdown({
        content: [
          "# T01 Multi sentence result",
          "",
          "## Worker Type",
          "coding",
          "",
          "## 状态",
          "pending",
          "",
          "## 目标",
          "Test sentence count.",
          "",
          "## 验收标准",
          "- ok",
          "",
          "## Step List",
          "",
          "### S01",
          "- status: pending",
          "- task: Do one thing.",
          "- acceptance: Finish it.",
          "",
          "## Blockers",
          "- 暂无",
          "",
          "## 最近执行结果",
          "- First sentence. Second sentence.",
          "",
          "## Next Action Hint",
          "- Start.",
        ].join("\n"),
        taskDir: "tasks/T01",
        taskPath: "tasks/T01/plan.md",
      }),
    ).toThrow(/最近执行结果 must be exactly one sentence/i);
  });
});
