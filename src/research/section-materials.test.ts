import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderPaperSectionMarkdown } from "./papers.js";
import {
  alignSectionExemplars,
  buildExemplarMaterialRecords,
  buildSectionBrief,
} from "./section-materials.js";
import {
  initializeResearchWorkspace,
  initializeSectionArtifacts,
  resolveResearchWorkspacePaths,
} from "./workspace.js";

describe("section exemplar materials", () => {
  it("keeps exemplar directory names stable as paper_01 and paper_02", () => {
    const records = buildExemplarMaterialRecords({
      sectionSlug: "introduction",
      papers: [
        {
          citationKey: "alpha2026",
          title: "Alpha",
          pdfUrl: "https://example.com/alpha.pdf",
          shortIntro: "Short alpha exemplar.",
          whyRelevant: "First intro exemplar.",
        },
        {
          citationKey: "beta2025",
          title: "Beta",
          pdfUrl: "https://example.com/beta.pdf",
          shortIntro: "Short beta exemplar.",
          whyRelevant: "Second intro exemplar.",
        },
      ],
    });

    expect(records.map((record) => record.dirPath)).toEqual([
      "section_materials/introduction/papers/paper_01",
      "section_materials/introduction/papers/paper_02",
    ]);
  });

  it("requires exactly two exemplars for every target section", () => {
    expect(() =>
      alignSectionExemplars({
        sections: [{ id: "S01", name: "introduction" }],
        parsedSections: [
          {
            section: "introduction",
            papers: [
              {
                citationKey: "alpha2026",
                title: "Alpha",
                pdfUrl: "https://example.com/alpha.pdf",
                shortIntro: "Short alpha exemplar.",
                whyRelevant: "Only one paper on purpose.",
              },
            ],
          },
        ],
      }),
    ).toThrow(/exactly two exemplar papers/);
  });

  it("builds a section brief with source section paths and citation keys", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "research-brief-"));
    const paths = resolveResearchWorkspacePaths(workspaceDir);
    await initializeResearchWorkspace(paths);
    await fs.writeFile(paths.literatureReviewPath, "# Literature Review\n", "utf-8");
    await fs.mkdir(paths.manuscriptSectionsDir, { recursive: true });
    await fs.writeFile(
      path.join(paths.manuscriptSectionsDir, "introduction.tex"),
      "% existing tex\n",
      "utf-8",
    );
    await initializeSectionArtifacts({
      paths,
      sections: [{ id: "S01", name: "introduction" }],
      writingStructureBySection: new Map([
        [
          "introduction",
          {
            id: "S01",
            name: "introduction",
            writingGoal: "Establish the framing and contribution.",
            keyPoints: ["State the motivation", "List the contributions"],
            questionsToAnswer: ["Why does the problem matter?"],
            avoidPatterns: ["Do not turn the introduction into related work."],
            requiredContext: ["references_bib", "literature_review"],
          },
        ],
      ]),
      citationsBySection: new Map([["introduction", "# introduction 引用候选\n"]]),
      exemplarsBySection: new Map([
        [
          "introduction",
          [
            {
              citationKey: "alpha2026",
              title: "Alpha",
              pdfUrl: "https://example.com/alpha.pdf",
              shortIntro: "Short alpha exemplar.",
              whyRelevant: "First intro exemplar.",
            },
            {
              citationKey: "beta2025",
              title: "Beta",
              pdfUrl: "https://example.com/beta.pdf",
              shortIntro: "Short beta exemplar.",
              whyRelevant: "Second intro exemplar.",
            },
          ],
        ],
      ]),
    });

    const paper01Dir = path.join(
      paths.sectionMaterialsDir,
      "introduction",
      "papers",
      "paper_01",
      "source_sections",
    );
    const paper02Dir = path.join(
      paths.sectionMaterialsDir,
      "introduction",
      "papers",
      "paper_02",
      "source_sections",
    );
    await fs.mkdir(paper01Dir, { recursive: true });
    await fs.mkdir(paper02Dir, { recursive: true });
    await fs.writeFile(
      path.join(paper01Dir, "02-introduction.md"),
      renderPaperSectionMarkdown({
        paperTitle: "Alpha",
        citationKey: "alpha2026",
        sectionTitle: "Introduction",
        sectionSlug: "introduction",
        body: "Intro body.",
      }),
      "utf-8",
    );
    await fs.writeFile(
      path.join(paper02Dir, "03-background.md"),
      renderPaperSectionMarkdown({
        paperTitle: "Beta",
        citationKey: "beta2025",
        sectionTitle: "Background",
        sectionSlug: "background",
        body: "Background body.",
      }),
      "utf-8",
    );

    const brief = await buildSectionBrief({
      paths,
      section: {
        id: "S01",
        name: "introduction",
        writingGoal: "Establish the framing and contribution.",
        keyPoints: ["State the motivation", "List the contributions"],
        questionsToAnswer: ["Why does the problem matter?"],
        avoidPatterns: ["Do not turn the introduction into related work."],
        requiredContext: ["references_bib", "literature_review", "existing_tex"],
      },
    });

    expect(brief.latexOutputPath).toBe("manuscript/sections/introduction.tex");
    expect(brief.referencesBibPath).toBe("references.bib");
    expect(brief.literatureReviewPath).toBe("literature_review.md");
    expect(brief.existingTexPaths).toEqual(["manuscript/sections/introduction.tex"]);
    expect(brief.keyPoints).toEqual(["State the motivation", "List the contributions"]);
    expect(brief.sourceSections.map((entry) => entry.relativePath)).toEqual([
      "section_materials/introduction/papers/paper_01/source_sections/02-introduction.md",
      "section_materials/introduction/papers/paper_02/source_sections/03-background.md",
    ]);
    expect(brief.sourceSections.map((entry) => entry.citationKey)).toEqual([
      "alpha2026",
      "beta2025",
    ]);
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("does not create inject.md while regenerating section materials", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "research-no-inject-"));
    const paths = resolveResearchWorkspacePaths(workspaceDir);
    await initializeResearchWorkspace(paths);
    await initializeSectionArtifacts({
      paths,
      sections: [{ id: "S01", name: "introduction" }],
      writingStructureBySection: new Map([
        [
          "introduction",
          {
            id: "S01",
            name: "introduction",
            writingGoal: "Establish the framing and contribution.",
            keyPoints: ["State the motivation"],
            questionsToAnswer: ["Why does the problem matter?"],
            avoidPatterns: ["Do not turn the introduction into related work."],
            requiredContext: [],
          },
        ],
      ]),
      citationsBySection: new Map([["introduction", "# introduction 引用候选\n"]]),
      exemplarsBySection: new Map([
        [
          "introduction",
          [
            {
              citationKey: "alpha2026",
              title: "Alpha",
              pdfUrl: "https://example.com/alpha.pdf",
              shortIntro: "Short alpha exemplar.",
              whyRelevant: "First intro exemplar.",
            },
            {
              citationKey: "beta2025",
              title: "Beta",
              pdfUrl: "https://example.com/beta.pdf",
              shortIntro: "Short beta exemplar.",
              whyRelevant: "Second intro exemplar.",
            },
          ],
        ],
      ]),
    });

    const injectPath = path.join(paths.sectionMaterialsDir, "introduction", "inject.md");
    await expect(fs.access(injectPath)).rejects.toThrow();
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });
});
