import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  materializeExemplarPapers,
  renderPaperSectionMarkdown,
  splitPaperIntoSections,
} from "./papers.js";
import { resolveResearchWorkspacePaths } from "./workspace.js";

async function makeTempDir(prefix: string) {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("research paper materialization", () => {
  const createdDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdDirs.splice(0).map(async (dir) => await fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("downloads source.pdf and writes section markdown files", async () => {
    const root = await makeTempDir("research-papers-");
    createdDirs.push(root);

    const paths = resolveResearchWorkspacePaths(root);
    const exemplarsBySection = new Map([
      [
        "introduction",
        [
          {
            citationKey: "alpha2026",
            title: "Alpha Paper",
            pdfUrl: "https://example.com/alpha.pdf",
            shortIntro: "Short alpha exemplar.",
            whyRelevant: "Fits the introduction structure.",
          },
          {
            citationKey: "beta2025",
            title: "Beta Paper",
            pdfUrl: "https://example.com/beta.pdf",
            shortIntro: "Short beta exemplar.",
            whyRelevant: "Adds a second writing pattern.",
          },
        ],
      ],
    ]);

    await materializeExemplarPapers({
      paths,
      exemplarsBySection,
      downloadPdf: async (url) => Buffer.from(`pdf:${url}`),
      extractPages: async () => [
        "Abstract\nAlpha abstract body.\n\n1 Introduction\nAlpha intro body.\n\n2 Method\nAlpha method body.",
      ],
    });

    await expect(
      fs.readFile(
        path.join(root, "section_materials", "introduction", "papers", "paper_01", "source.pdf"),
      ),
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
          "01-abstract.md",
        ),
        "utf-8",
      ),
    ).resolves.toContain("- citation_key: alpha2026");
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
    ).resolves.toContain("Alpha intro body.");
  });

  it("records extract failures instead of silently dropping the PDF", async () => {
    const root = await makeTempDir("research-paper-failure-");
    createdDirs.push(root);

    const paths = resolveResearchWorkspacePaths(root);
    const exemplarsBySection = new Map([
      [
        "method",
        [
          {
            citationKey: "alpha2026",
            title: "Alpha Paper",
            pdfUrl: "https://example.com/alpha.pdf",
            shortIntro: "Short alpha exemplar.",
            whyRelevant: "Fits the method structure.",
          },
          {
            citationKey: "beta2025",
            title: "Beta Paper",
            pdfUrl: "[待核实] beta",
            shortIntro: "Short beta exemplar.",
            whyRelevant: "Pending verification.",
          },
        ],
      ],
    ]);

    await materializeExemplarPapers({
      paths,
      exemplarsBySection,
      downloadPdf: async () => Buffer.from("pdf"),
      extractPages: async () => {
        throw new Error("mock extract failed");
      },
    });

    await expect(
      fs.readFile(
        path.join(root, "section_materials", "method", "papers", "paper_01", "source_failure.md"),
        "utf-8",
      ),
    ).resolves.toContain("- stage: extract");
    await expect(
      fs.readFile(
        path.join(root, "section_materials", "method", "papers", "paper_02", "source_failure.md"),
        "utf-8",
      ),
    ).resolves.toContain("not a verified http(s) URL");
  });

  it("uses page fallback when stable headings cannot be recovered", () => {
    const parsed = splitPaperIntoSections({
      pages: ["First page body without headings.", "Second page body without headings."],
    });

    expect(parsed.strategy).toBe("page-fallback");
    expect(parsed.sections.map((section) => section.slug)).toEqual(["page-01", "page-02"]);
  });

  it("renders source section markdown with the required fields", () => {
    const markdown = renderPaperSectionMarkdown({
      paperTitle: "Alpha Paper",
      citationKey: "alpha2026",
      sectionTitle: "Introduction",
      sectionSlug: "introduction",
      body: "Intro body.",
    });

    expect(markdown).toContain("- paper_title: Alpha Paper");
    expect(markdown).toContain("- citation_key: alpha2026");
    expect(markdown).toContain("- section_title: Introduction");
    expect(markdown).toContain("- section_slug: introduction");
    expect(markdown).toContain("Intro body.");
  });
});
