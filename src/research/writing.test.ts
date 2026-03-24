import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderPaperSectionMarkdown } from "./papers.js";
import {
  buildWritingSectionTaskPackage,
  parseSectionBriefMarkdown,
  renderWritingSectionTaskPackageMarkdown,
  validateLatexSectionSanity,
  writeWritingSectionTaskPackage,
} from "./writing.js";
import {
  initializeResearchWorkspace,
  initializeSectionArtifacts,
  resolveResearchWorkspacePaths,
} from "./workspace.js";

describe("research writing helpers", () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirs.splice(0).map(async (dir) => await fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("parses brief markdown with source sections and optional reads", () => {
    const parsed = parseSectionBriefMarkdown([
      "# introduction Brief",
      "",
      "- section_id: S01",
      "- section_title: introduction",
      "- writing_goal: Explain the framing.",
      "- latex_output_path: manuscript/sections/introduction.tex",
      "",
      "## Source Section Mapping",
      "",
      "- source_section_path: section_materials/introduction/papers/paper_01/source_sections/01.md",
      "  - citation_key: alpha2026",
      "",
      "## Additional Reads",
      "",
      "- references_bib: references.bib",
      "- literature_review: literature_review.md",
      "- experiment_result_paths:",
      "  - tasks/T01/outputs/result.json",
      "- existing_tex_paths:",
      "  - manuscript/sections/introduction.tex",
      "",
    ].join("\n"));

    expect(parsed.sectionId).toBe("S01");
    expect(parsed.sourceSectionPaths).toEqual([
      "section_materials/introduction/papers/paper_01/source_sections/01.md",
    ]);
    expect(parsed.sourceSectionCitationKeys).toEqual(["alpha2026"]);
    expect(parsed.experimentResultPaths).toEqual(["tasks/T01/outputs/result.json"]);
    expect(parsed.existingTexPaths).toEqual(["manuscript/sections/introduction.tex"]);
  });

  it("builds a section task package from brief and selected source sections", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "research-writing-package-"));
    createdDirs.push(workspaceDir);
    const paths = resolveResearchWorkspacePaths(workspaceDir);
    await initializeResearchWorkspace(paths);
    await fs.mkdir(paths.manuscriptSectionsDir, { recursive: true });
    await fs.writeFile(path.join(paths.manuscriptSectionsDir, "introduction.tex"), "% intro\n");
    await fs.writeFile(paths.referencesPath, "@article{alpha2026,title={Alpha}}\n");
    await fs.writeFile(paths.literatureReviewPath, "# Literature Review\n");
    await initializeSectionArtifacts({
      paths,
      sections: [{ id: "S01", name: "introduction" }],
      writingStructureBySection: new Map([
        [
          "introduction",
          {
            id: "S01",
            name: "introduction",
            writingGoal: "Establish the problem framing.",
            keyPoints: ["State the motivation", "List the contribution"],
            questionsToAnswer: ["Why does the problem matter?"],
            avoidPatterns: ["Do not turn the section into related work."],
            requiredContext: ["references_bib", "literature_review", "existing_tex"],
          },
        ],
      ]),
      citationsBySection: new Map([
        [
          "introduction",
          [
            "# introduction 引用候选",
            "",
            "### Alpha",
            "",
            "- cite_key: alpha2026",
            "- summary: Alpha summary.",
            "",
          ].join("\n"),
        ],
      ]),
      exemplarsBySection: new Map([
        [
          "introduction",
          [
            {
              citationKey: "alpha2026",
              title: "Alpha",
              pdfUrl: "https://example.com/alpha.pdf",
              shortIntro: "Alpha intro.",
              whyRelevant: "Intro pattern.",
            },
            {
              citationKey: "beta2026",
              title: "Beta",
              pdfUrl: "https://example.com/beta.pdf",
              shortIntro: "Beta intro.",
              whyRelevant: "Backup pattern.",
            },
          ],
        ],
      ]),
    });
    await fs.mkdir(path.join(workspaceDir, "tasks", "T05", "outputs"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, "tasks", "T05", "summary.md"),
      "# Summary\n\n- done\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(workspaceDir, "tasks", "T05", "outputs", "result.json"),
      '{"taskId":"T05","status":"done","summary":"ok"}\n',
      "utf-8",
    );
    await fs.mkdir(path.join(workspaceDir, "tasks", "T01", "outputs"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, "tasks", "T01", "summary.md"),
      "# Summary\n\n- experiment summary\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(workspaceDir, "tasks", "T01", "outputs", "result.json"),
      '{"taskId":"T01","status":"done","summary":"experiment ok"}\n',
      "utf-8",
    );
    await fs.mkdir(
      path.join(
        paths.sectionMaterialsDir,
        "introduction",
        "papers",
        "paper_01",
        "source_sections",
      ),
      { recursive: true },
    );
    await fs.mkdir(
      path.join(
        paths.sectionMaterialsDir,
        "introduction",
        "papers",
        "paper_02",
        "source_sections",
      ),
      { recursive: true },
    );
    await fs.writeFile(
      path.join(
        paths.sectionMaterialsDir,
        "introduction",
        "papers",
        "paper_01",
        "source_sections",
        "01-introduction.md",
      ),
      renderPaperSectionMarkdown({
        paperTitle: "Alpha",
        citationKey: "alpha2026",
        sectionTitle: "Introduction",
        sectionSlug: "introduction",
        body: "Alpha body.",
      }),
      "utf-8",
    );
    await fs.writeFile(
      path.join(
        paths.sectionMaterialsDir,
        "introduction",
        "papers",
        "paper_02",
        "source_sections",
        "02-introduction.md",
      ),
      renderPaperSectionMarkdown({
        paperTitle: "Beta",
        citationKey: "beta2026",
        sectionTitle: "Introduction",
        sectionSlug: "introduction",
        body: "Beta body.",
      }),
      "utf-8",
    );
    await fs.writeFile(
      path.join(paths.sectionMaterialsDir, "introduction", "brief.md"),
      [
        "# introduction Brief",
        "",
        "- section_id: S01",
        "- section_title: introduction",
        "- writing_goal: Frame the problem.",
        "- latex_output_path: manuscript/sections/introduction.tex",
        "",
        "## Source Section Mapping",
        "",
        "- source_section_path: section_materials/introduction/papers/paper_01/source_sections/01-introduction.md",
        "  - citation_key: alpha2026",
        "- source_section_path: section_materials/introduction/papers/paper_02/source_sections/02-introduction.md",
        "  - citation_key: beta2026",
        "",
        "## Additional Reads",
        "",
        "- references_bib: references.bib",
        "- literature_review: literature_review.md",
        "- experiment_result_paths:",
        "  - tasks/*/outputs/result.json",
        "- existing_tex_paths:",
        "  - manuscript/sections/introduction.tex",
        "",
      ].join("\n"),
      "utf-8",
    );

    const taskPackage = await buildWritingSectionTaskPackage({
      workspaceDir,
      task: {
        id: "T05",
        title: "Draft intro",
        workerType: "writing",
        status: "in_progress",
        objective: "Write intro",
        acceptance: ["intro exists"],
        steps: [],
        sectionQueue: [],
        blockers: [],
        lastRunResult: "暂无",
        nextActionHint: "从 W01 开始",
        dir: "tasks/T05",
        path: path.join(workspaceDir, "tasks", "T05", "plan.md"),
      },
      queueItem: {
        id: "W01",
        status: "pending",
        sectionId: "S01",
        sectionSlug: "introduction",
        materialsDir: "section_materials/introduction",
        manuscriptPath: "manuscript/sections/introduction.tex",
        acceptance: "Write intro",
      },
    });

    expect(taskPackage.sectionId).toBe("S01");
    expect(taskPackage.briefPath).toBe("section_materials/introduction/brief.md");
    expect(taskPackage.sourceSectionPaths).toHaveLength(2);
    expect(taskPackage.outputTexPath).toBe("manuscript/sections/introduction.tex");
    expect(taskPackage.resultJsonPaths).toContain("tasks/T01/outputs/result.json");
    expect(taskPackage.summaryPaths).toContain("tasks/T01/summary.md");
    expect(taskPackage.citationKeys).toEqual(["alpha2026", "beta2026"]);
    expect(renderWritingSectionTaskPackageMarkdown(taskPackage)).toContain(
      "本轮只写当前 section，不允许跨 section 发散。",
    );
  });

  it("writes a single-section writing package file", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "research-writing-package-file-"));
    createdDirs.push(workspaceDir);
    const briefDir = path.join(workspaceDir, "section_materials", "introduction");
    await fs.mkdir(briefDir, { recursive: true });
    await fs.writeFile(
      path.join(briefDir, "brief.md"),
      [
        "# introduction Brief",
        "",
        "- section_id: S01",
        "- section_title: introduction",
        "- writing_goal: Frame the problem.",
        "- latex_output_path: manuscript/sections/introduction.tex",
        "",
        "## Source Section Mapping",
        "",
        "- source_section_path: section_materials/introduction/papers/paper_01/source_sections/01.md",
        "  - citation_key: alpha2026",
        "",
        "## Additional Reads",
        "",
        "- references_bib: none",
        "- literature_review: none",
        "- experiment_result_paths: none",
        "- existing_tex_paths: none",
        "",
      ].join("\n"),
      "utf-8",
    );

    const written = await writeWritingSectionTaskPackage({
      workspaceDir,
      task: {
        id: "T05",
        title: "Draft intro",
        workerType: "writing",
        status: "in_progress",
        objective: "Write intro",
        acceptance: ["intro exists"],
        steps: [],
        sectionQueue: [],
        blockers: [],
        lastRunResult: "暂无",
        nextActionHint: "从 W01 开始",
        dir: "tasks/T05",
        path: path.join(workspaceDir, "tasks", "T05", "plan.md"),
      },
      queueItem: {
        id: "W01",
        status: "pending",
        sectionId: "S01",
        sectionSlug: "introduction",
        materialsDir: "section_materials/introduction",
        manuscriptPath: "manuscript/sections/introduction.tex",
        acceptance: "Write intro",
      },
    });

    const packageMarkdown = await fs.readFile(
      path.join(workspaceDir, written.relativePath),
      "utf-8",
    );
    expect(written.relativePath).toBe("tasks/T05/writing_packages/W01.md");
    expect(packageMarkdown).toContain("- section_id: S01");
    expect(packageMarkdown).not.toContain("related-work");
  });

  it("rejects markdown-like tex output in LaTeX sanity check", () => {
    expect(
      validateLatexSectionSanity({
        content: "# Introduction\n\nThis is markdown.\n",
        manuscriptPath: "manuscript/sections/introduction.tex",
      }),
    ).toMatch(/Markdown/);
  });
});
