import fs from "node:fs/promises";
import path from "node:path";
import { parseSourceSectionMarkdown } from "./parsing.js";
import { renderExemplarMetaMarkdown } from "./render.js";
import { slugify } from "./shared.js";
import type {
  ResearchExemplarPaper,
  ResearchSectionBrief,
  ResearchSection,
  ResearchSectionExemplars,
  ResearchSourceSectionReference,
  ResearchWritingStructureSection,
  ResearchWorkspacePaths,
} from "./types.js";

const SECTION_SOURCE_SECTION_ALIASES: Record<string, string[]> = {
  abstract: ["abstract", "summary"],
  introduction: ["introduction", "background", "motivation", "overview"],
  "related-work": ["related-work", "background", "preliminaries"],
  method: [
    "method",
    "methods",
    "methodology",
    "approach",
    "approaches",
    "model",
    "models",
    "problem-formulation",
    "problem-setup",
  ],
  experiments: [
    "experimental-setup",
    "experiments",
    "experiment",
    "results",
    "analysis",
    "discussion",
    "ablation",
    "ablations",
    "evaluation",
  ],
  conclusion: ["conclusion", "conclusions", "discussion", "limitations", "future-work"],
};

export function alignSectionExemplars(params: {
  sections: ResearchSection[];
  parsedSections: ReadonlyArray<ResearchSectionExemplars>;
}): Map<string, ResearchExemplarPaper[]> {
  const parsedBySlug = new Map(
    params.parsedSections.map((section) => [slugify(section.section), section.papers] as const),
  );
  return new Map(
    params.sections.map((section) => {
      const slug = slugify(section.name);
      const papers = parsedBySlug.get(slug) ?? [];
      if (papers.length !== 2) {
        throw new Error(
          `Section ${slug} must have exactly two exemplar papers, received ${papers.length}.`,
        );
      }
      return [slug, papers] as const;
    }),
  );
}

export function buildExemplarMaterialRecords(params: {
  sectionSlug: string;
  papers: readonly ResearchExemplarPaper[];
}): Array<{ dirPath: string; metaPath: string; metaMarkdown: string }> {
  if (params.papers.length !== 2) {
    throw new Error(
      `Section ${params.sectionSlug} must materialize exactly two exemplar papers, received ${params.papers.length}.`,
    );
  }
  return params.papers.map((paper, index) => {
    const paperId = `paper_${String(index + 1).padStart(2, "0")}`;
    const dirPath = path.join("section_materials", params.sectionSlug, "papers", paperId);
    const metaPath = path.join(dirPath, "meta.md");
    return {
      dirPath,
      metaPath,
      metaMarkdown: renderExemplarMetaMarkdown({ paperId, paper }),
    };
  });
}

async function listPaperSourceSections(params: {
  paths: ResearchWorkspacePaths;
  sectionSlug: string;
  paperId: string;
}): Promise<ResearchSourceSectionReference[]> {
  const sourceSectionsDir = path.join(
    params.paths.sectionMaterialsDir,
    params.sectionSlug,
    "papers",
    params.paperId,
    "source_sections",
  );
  const fileNames = await fs.readdir(sourceSectionsDir).catch(() => []);
  const markdownFiles = fileNames.filter((fileName) => fileName.endsWith(".md")).sort();
  return await Promise.all(
    markdownFiles.map(async (fileName) => {
      const absolutePath = path.join(sourceSectionsDir, fileName);
      const relativePath = path.relative(params.paths.outputDir, absolutePath).replace(/\\/g, "/");
      const parsed = parseSourceSectionMarkdown(await fs.readFile(absolutePath, "utf-8"));
      return {
        paperId: params.paperId,
        citationKey: parsed.citationKey,
        sectionTitle: parsed.sectionTitle,
        sectionSlug: parsed.sectionSlug,
        relativePath,
        selectionReason: "matched_source_section",
      };
    }),
  );
}

export async function resolveSectionSourceSectionReferences(params: {
  paths: ResearchWorkspacePaths;
  sectionSlug: string;
}): Promise<ResearchSourceSectionReference[]> {
  const paperIds = ["paper_01", "paper_02"];
  const candidateSlugs = new Set(
    (SECTION_SOURCE_SECTION_ALIASES[params.sectionSlug] ?? [params.sectionSlug]).map((entry) =>
      slugify(entry),
    ),
  );
  const perPaper = await Promise.all(
    paperIds.map(async (paperId) => ({
      paperId,
      sections: await listPaperSourceSections({
        paths: params.paths,
        sectionSlug: params.sectionSlug,
        paperId,
      }),
    })),
  );

  return perPaper.flatMap(({ paperId, sections }) => {
    const matched = sections.filter((entry) => candidateSlugs.has(entry.sectionSlug));
    if (matched.length > 0) {
      return matched.map((entry) => ({
        ...entry,
        selectionReason: `matched ${params.sectionSlug} section semantics from ${paperId}`,
      }));
    }
    return sections.map((entry) => ({
      ...entry,
      selectionReason: `fallback to all available source sections from ${paperId} because no canonical heading matched ${params.sectionSlug}`,
    }));
  });
}

export async function buildSectionBrief(params: {
  paths: ResearchWorkspacePaths;
  section: ResearchWritingStructureSection;
}): Promise<ResearchSectionBrief> {
  const sectionSlug = slugify(params.section.name);
  const latexOutputPath = path.join("manuscript", "sections", `${sectionSlug}.tex`).replace(/\\/g, "/");
  const requiredContext = new Set(params.section.requiredContext);
  const literatureReviewExists = await fs
    .access(params.paths.literatureReviewPath)
    .then(() => true)
    .catch(() => false);
  const existingTexExists = await fs
    .access(path.join(params.paths.outputDir, latexOutputPath))
    .then(() => true)
    .catch(() => false);
  const sourceSections = await resolveSectionSourceSectionReferences({
    paths: params.paths,
    sectionSlug,
  });

  return {
    sectionId: params.section.id,
    sectionTitle: sectionSlug,
    writingGoal: params.section.writingGoal,
    keyPoints: params.section.keyPoints,
    questionsToAnswer: params.section.questionsToAnswer,
    avoidPatterns: params.section.avoidPatterns,
    latexOutputPath,
    sourceSections,
    referencesBibPath: requiredContext.has("references_bib") ? "references.bib" : undefined,
    literatureReviewPath:
      requiredContext.has("literature_review") && literatureReviewExists
        ? "literature_review.md"
        : undefined,
    experimentResultPaths:
      requiredContext.has("experiment_results") ? ["tasks/*/outputs/result.json"] : [],
    existingTexPaths:
      requiredContext.has("existing_tex") && existingTexExists ? [latexOutputPath] : [],
  };
}
