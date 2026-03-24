import fs from "node:fs/promises";
import path from "node:path";
import { extractPdfTextPages } from "../media/pdf-extract.js";
import { ensureTrailingLine, normalizeWhitespace, slugify } from "./shared.js";
import type { ResearchExemplarPaper, ResearchWorkspacePaths } from "./types.js";

const KNOWN_SECTION_TITLES = [
  "abstract",
  "introduction",
  "background",
  "related work",
  "preliminaries",
  "problem formulation",
  "problem setup",
  "method",
  "methods",
  "methodology",
  "approach",
  "approaches",
  "model",
  "models",
  "experimental setup",
  "experiments",
  "experiment",
  "results",
  "analysis",
  "discussion",
  "limitations",
  "ablation",
  "ablations",
  "conclusion",
  "conclusions",
  "references",
  "acknowledgements",
  "acknowledgments",
  "appendix",
];

type PaperArtifactPaths = {
  paperDir: string;
  pdfPath: string;
  sourceSectionsDir: string;
  failurePath: string;
};

type MaterializePaperDependencies = {
  fetchImpl?: typeof fetch;
  downloadPdf?: (url: string) => Promise<Buffer>;
  extractPages?: (buffer: Buffer) => Promise<string[]>;
};

type PaperSection = {
  title: string;
  slug: string;
  body: string;
};

function resolvePaperArtifactPaths(params: {
  paths: ResearchWorkspacePaths;
  sectionSlug: string;
  paperId: string;
}): PaperArtifactPaths {
  const paperDir = path.join(
    params.paths.sectionMaterialsDir,
    params.sectionSlug,
    "papers",
    params.paperId,
  );
  return {
    paperDir,
    pdfPath: path.join(paperDir, "source.pdf"),
    sourceSectionsDir: path.join(paperDir, "source_sections"),
    failurePath: path.join(paperDir, "source_failure.md"),
  };
}

function isDownloadablePdfUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function normalizePageText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/-\n(?=[a-z])/g, "")
    .trim();
}

function normalizeSectionText(text: string): string {
  return ensureTrailingLine(
    text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function cleanupHeadingTitle(title: string): string {
  return normalizeWhitespace(
    title
      .replace(/^[\dIVXLCM.]+\s+/i, "")
      .replace(/\s+/g, " ")
      .replace(/[.:]+$/g, ""),
  );
}

function isLikelyHeading(line: string): boolean {
  const normalized = normalizeWhitespace(line).replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > 90) {
    return false;
  }
  const lower = normalized.toLowerCase();
  if (KNOWN_SECTION_TITLES.includes(lower)) {
    return true;
  }
  if (/^(references|appendix)\b/i.test(lower)) {
    return true;
  }
  if (/^(?:\d+(?:\.\d+)*|[ivxlcdm]+)\.?\s+[a-z][a-z0-9]/i.test(lower)) {
    return true;
  }
  return /^[A-Z][A-Z0-9/&,:;() -]{2,80}$/.test(normalized);
}

function splitByDetectedHeadings(text: string): PaperSection[] {
  const lines = normalizePageText(text)
    .split("\n")
    .map((line) => line.trim());
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (isLikelyHeading(line)) {
      const title = cleanupHeadingTitle(line);
      if (title.length === 0) {
        continue;
      }
      if (current && normalizeSectionText(current.lines.join("\n")).trim().length === 0) {
        current.title = title;
        continue;
      }
      current = { title, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: "Abstract", lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }

  return sections
    .map((section) => ({
      title: section.title,
      slug: slugify(section.title),
      body: normalizeSectionText(section.lines.join("\n")),
    }))
    .filter((section) => section.body.trim().length > 0);
}

function splitByInlineHeadings(text: string): PaperSection[] {
  const normalized = normalizePageText(text);
  const regex =
    /\b(Abstract|Introduction|Background|Related Work|Preliminaries|Method(?:ology)?|Approach|Model|Experimental Setup|Experiments?|Results?|Analysis|Discussion|Limitations|Conclusion|Conclusions|References|Appendix)\b/gi;
  const matches = Array.from(normalized.matchAll(regex));
  if (matches.length < 2) {
    return [];
  }

  const sections: PaperSection[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = cleanupHeadingTitle(match?.[1] ?? "");
    const start = match?.index ?? 0;
    const end = matches[index + 1]?.index ?? normalized.length;
    const body = normalizeSectionText(normalized.slice(start + title.length, end));
    if (title.length > 0 && body.trim().length > 0) {
      sections.push({ title, slug: slugify(title), body });
    }
  }
  return sections;
}

function splitByPageHeuristic(pages: readonly string[]): PaperSection[] {
  return pages
    .map((page, index) => {
      const title = `Page ${index + 1}`;
      return {
        title,
        slug: `page-${String(index + 1).padStart(2, "0")}`,
        body: normalizeSectionText(page),
      };
    })
    .filter((section) => section.body.trim().length > 0);
}

export function splitPaperIntoSections(params: { pages: readonly string[] }): {
  sections: PaperSection[];
  strategy: "headings" | "inline-headings" | "page-fallback";
} {
  const pages = params.pages.map(normalizePageText).filter((page) => page.length > 0);
  const fullText = pages.join("\n\n");

  const fromHeadings = splitByDetectedHeadings(fullText);
  if (fromHeadings.length >= 2) {
    return { sections: fromHeadings, strategy: "headings" };
  }

  const fromInlineHeadings = splitByInlineHeadings(fullText);
  if (fromInlineHeadings.length >= 2) {
    return { sections: fromInlineHeadings, strategy: "inline-headings" };
  }

  return {
    sections: splitByPageHeuristic(pages),
    strategy: "page-fallback",
  };
}

export function renderPaperSectionMarkdown(params: {
  paperTitle: string;
  citationKey: string;
  sectionTitle: string;
  sectionSlug: string;
  body: string;
}): string {
  return ensureTrailingLine(
    [
      `# ${params.sectionTitle}`,
      "",
      `- paper_title: ${params.paperTitle}`,
      `- citation_key: ${params.citationKey}`,
      `- section_title: ${params.sectionTitle}`,
      `- section_slug: ${params.sectionSlug}`,
      "",
      params.body.trim(),
    ].join("\n"),
  );
}

export function renderPaperFailureMarkdown(params: {
  paper: ResearchExemplarPaper;
  stage: "download" | "extract";
  reason: string;
}): string {
  return ensureTrailingLine(
    [
      "# Source Failure",
      "",
      `- paper_title: ${params.paper.title}`,
      `- citation_key: ${params.paper.citationKey}`,
      `- pdf_url: ${params.paper.pdfUrl}`,
      `- stage: ${params.stage}`,
      `- reason: ${normalizeWhitespace(params.reason)}`,
    ].join("\n"),
  );
}

async function rmIfExists(targetPath: string): Promise<void> {
  await fs.rm(targetPath, { recursive: true, force: true });
}

export async function materializeExemplarPapers(params: {
  paths: ResearchWorkspacePaths;
  exemplarsBySection: ReadonlyMap<string, readonly ResearchExemplarPaper[]>;
  fetchImpl?: typeof fetch;
  downloadPdf?: (url: string) => Promise<Buffer>;
  extractPages?: (buffer: Buffer) => Promise<string[]>;
}): Promise<void> {
  const fetchImpl = params.fetchImpl ?? globalThis.fetch;
  const pdfCache = new Map<string, Promise<Buffer>>();
  const downloadPdf =
    params.downloadPdf ??
    (async (url: string) => {
      let pending = pdfCache.get(url);
      if (!pending) {
        pending = (async () => {
          const response = await fetchImpl(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} while downloading PDF`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        })();
        pdfCache.set(url, pending);
      }
      return await pending;
    });
  const extractPages =
    params.extractPages ??
    (async (buffer: Buffer) =>
      await extractPdfTextPages({
        buffer,
        maxPages: 128,
        minTextChars: 32,
      }));

  for (const [sectionSlug, papers] of params.exemplarsBySection.entries()) {
    for (const [index, paper] of papers.entries()) {
      const paperId = `paper_${String(index + 1).padStart(2, "0")}`;
      const artifactPaths = resolvePaperArtifactPaths({
        paths: params.paths,
        sectionSlug,
        paperId,
      });
      await fs.mkdir(artifactPaths.paperDir, { recursive: true });

      if (!isDownloadablePdfUrl(paper.pdfUrl)) {
        await Promise.all([
          rmIfExists(artifactPaths.pdfPath),
          rmIfExists(artifactPaths.sourceSectionsDir),
          fs.writeFile(
            artifactPaths.failurePath,
            renderPaperFailureMarkdown({
              paper,
              stage: "download",
              reason: "pdf_url is not a verified http(s) URL.",
            }),
            "utf-8",
          ),
        ]);
        continue;
      }

      try {
        const pdfBuffer = await downloadPdf(paper.pdfUrl);
        await fs.writeFile(artifactPaths.pdfPath, pdfBuffer);
        const pages = await extractPages(pdfBuffer);
        const nonEmptyPages = pages.map(normalizePageText).filter((page) => page.length > 0);
        if (nonEmptyPages.length === 0) {
          throw new Error("PDF extraction returned no readable text.");
        }

        const { sections } = splitPaperIntoSections({ pages: nonEmptyPages });
        if (sections.length === 0) {
          throw new Error("Failed to recover section boundaries from extracted PDF text.");
        }

        await Promise.all([
          rmIfExists(artifactPaths.failurePath),
          rmIfExists(artifactPaths.sourceSectionsDir),
        ]);
        await fs.mkdir(artifactPaths.sourceSectionsDir, { recursive: true });
        await Promise.all(
          sections.map(async (section, sectionIndex) => {
            const fileName = `${String(sectionIndex + 1).padStart(2, "0")}-${section.slug}.md`;
            await fs.writeFile(
              path.join(artifactPaths.sourceSectionsDir, fileName),
              renderPaperSectionMarkdown({
                paperTitle: paper.title,
                citationKey: paper.citationKey,
                sectionTitle: section.title,
                sectionSlug: section.slug,
                body: section.body,
              }),
              "utf-8",
            );
          }),
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await Promise.all([
          rmIfExists(artifactPaths.sourceSectionsDir),
          fs.writeFile(
            artifactPaths.failurePath,
            renderPaperFailureMarkdown({
              paper,
              stage: (await fs
                .access(artifactPaths.pdfPath)
                .then(() => true)
                .catch(() => false))
                ? "extract"
                : "download",
              reason,
            }),
            "utf-8",
          ),
        ]);
      }
    }
  }
}
