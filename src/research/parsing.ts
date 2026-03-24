import { z } from "zod";
import { ResearchApiError } from "../commands/research.openai.js";
import { ensureTrailingLine, escapeRegExp, slugify } from "./shared.js";
import type {
  ParsedTaskPlan,
  ResearchLayoutSection,
  ResearchPlanItemStatus,
  ResearchTaskWorkerType,
  ResearchSourceSectionReference,
  ResearchExemplarPaper,
  ResearchSectionCitations,
  ResearchSectionExemplars,
  ResearchSpecification,
  ResearchTodoItem,
} from "./types.js";

export type ParsedWorkerStdoutBrief = {
  result: "done" | "blocked" | "failed";
  summary: string;
  planUpdate: string;
  nextHint: string;
};

export type PaperTextOutput = {
  bib: string;
  bibEntryKeys: string[];
  sectionCitations: ResearchSectionCitations[];
  sectionExemplars: ResearchSectionExemplars[];
  literatureReviewMarkdown?: string;
};

export type ParsedSourceSectionMarkdown = Omit<
  ResearchSourceSectionReference,
  "paperId" | "relativePath" | "selectionReason"
>;

type SectionNote = {
  title: string;
  citationKey: string;
  summary: string;
};

const PaperStageJsonSchema = z.object({
  bib: z.string().min(1),
  sections: z
    .array(
      z.object({
        section: z.string().min(1),
        entries: z
          .array(
            z.object({
              title: z.string().min(1),
              citationKey: z.string().min(1),
              summary: z.string().min(1),
            }),
          )
          .default([]),
      }),
    )
    .min(1),
});

function countSentences(text: string): number {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return 0;
  }
  const matches = normalized.match(/[.!?。！？]+(?=\s|$)/g);
  return matches?.length ?? 1;
}

function validateShortIntro(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    throw new Error(`Exemplar paper short_intro must not be empty.`);
  }
  if (normalized.length > 120) {
    throw new Error(`Exemplar paper short_intro must stay within 120 characters.`);
  }
  if (countSentences(normalized) > 1) {
    throw new Error(`Exemplar paper short_intro must be exactly one short sentence.`);
  }
  return normalized;
}

function splitMarkedBlock(text: string, start: string, end?: string): string {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) {
    return "";
  }
  const contentStart = startIndex + start.length;
  const tail = text.slice(contentStart);
  if (!end) {
    return tail.trim();
  }
  const endIndex = tail.indexOf(end);
  return (endIndex === -1 ? tail : tail.slice(0, endIndex)).trim();
}

function normalizeCitationKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const citeMatch = trimmed.match(/\\cite\w*\{([^}]+)\}/);
  if (citeMatch?.[1]) {
    return citeMatch[1].split(",")[0]?.trim() ?? "";
  }
  return trimmed.replace(/^`+|`+$/g, "").trim();
}

function countBibBraces(line: string): number {
  let balance = 0;
  for (const char of line) {
    if (char === "{") {
      balance += 1;
    } else if (char === "}") {
      balance -= 1;
    }
  }
  return balance;
}

function extractBibEntries(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const entries: string[] = [];
  let current: string[] = [];
  let balance = 0;
  let inEntry = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!inEntry) {
      if (!trimmed.startsWith("@")) {
        continue;
      }
      inEntry = true;
      current = [line];
      balance = countBibBraces(line);
      if (balance <= 0) {
        entries.push(current.join("\n").trim());
        current = [];
        balance = 0;
        inEntry = false;
      }
      continue;
    }

    current.push(line);
    balance += countBibBraces(line);
    if (balance <= 0) {
      entries.push(current.join("\n").trim());
      current = [];
      balance = 0;
      inEntry = false;
    }
  }

  if (inEntry) {
    throw new Error(`BibTeX section ended before an entry was closed.`);
  }
  return entries.filter(Boolean);
}

function extractBibEntryKey(entry: string): string {
  const key = entry.match(/^\s*@[\w-]+\s*\{\s*([^,\s]+)\s*,/m)?.[1]?.trim() ?? "";
  if (key.length === 0) {
    throw new Error(`Failed to parse BibTeX cite key from entry:\n${entry}`);
  }
  return key;
}

function normalizeBibtex(markdown: string): { bib: string; citeKeys: string[] } {
  const entries = extractBibEntries(markdown);
  if (entries.length === 0) {
    throw new Error(`BibTeX section does not contain any citeable entries.`);
  }
  const citeKeys = entries.map(extractBibEntryKey);
  const duplicates = citeKeys.filter((key, index) => citeKeys.indexOf(key) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `BibTeX section contains duplicate cite keys: ${[...new Set(duplicates)].join(", ")}`,
    );
  }
  return {
    bib: ensureTrailingLine(entries.join("\n\n")),
    citeKeys,
  };
}

function parseSectionNotes(markdown: string): ResearchSectionCitations[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) {
    return [];
  }
  const sections = normalized
    .split(/^##\s+/m)
    .map((block) => block.trim())
    .filter(Boolean);
  return sections
    .map((block) => {
      const lines = block.split("\n");
      const rawHeading = lines.shift()?.trim() ?? "";
      const titleMatch = rawHeading.match(/^(.+?)\s*$/);
      const section = slugify(titleMatch?.[1] ?? rawHeading);
      const body = lines.join("\n").trim();
      if (section.length === 0 || body.length === 0) {
        return null;
      }
      const entries = body
        .split(/^###\s+/m)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry): SectionNote | null => {
          const entryLines = entry.split("\n");
          const title = entryLines.shift()?.trim() ?? "";
          const citationKey = normalizeCitationKey(entryLines.shift()?.trim() ?? "");
          const summary = entryLines.join("\n").trim();
          if (title.length === 0 || citationKey.length === 0 || summary.length === 0) {
            return null;
          }
          return { title, citationKey, summary };
        })
        .filter((entry): entry is SectionNote => Boolean(entry));
      if (entries.length === 0) {
        return null;
      }
      return {
        section,
        entries,
      };
    })
    .filter((entry): entry is ResearchSectionCitations => Boolean(entry));
}

function parseExemplarPapers(markdown: string): ResearchSectionExemplars[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (normalized.length === 0) {
    return [];
  }
  const sections = normalized
    .split(/^##\s+/m)
    .map((block) => block.trim())
    .filter(Boolean);
  return sections
    .map((block) => {
      const lines = block.split("\n");
      const rawHeading = lines.shift()?.trim() ?? "";
      const section = slugify(rawHeading);
      const body = lines.join("\n").trim();
      if (section.length === 0 || body.length === 0) {
        return null;
      }
      const papers = body
        .split(/^###\s+/m)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry): ResearchExemplarPaper | null => {
          const entryLines = entry
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          const title = entryLines.shift()?.trim() ?? "";
          const citationKey = parseLabeledLine(entryLines, "citation_key");
          const pdfUrl = parseLabeledLine(entryLines, "pdf_url");
          const shortIntro = validateShortIntro(parseLabeledLine(entryLines, "short_intro"));
          const whyRelevant = parseLabeledLine(entryLines, "why_relevant");
          if (
            title.length === 0 ||
            citationKey === "UNKNOWN" ||
            pdfUrl === "UNKNOWN" ||
            shortIntro === "UNKNOWN" ||
            whyRelevant === "UNKNOWN"
          ) {
            return null;
          }
          return {
            title,
            citationKey,
            pdfUrl,
            shortIntro,
            whyRelevant,
          };
        })
        .filter((paper): paper is ResearchExemplarPaper => Boolean(paper));
      if (papers.length === 0) {
        return null;
      }
      return { section, papers };
    })
    .filter((section): section is ResearchSectionExemplars => Boolean(section));
}

export function parsePaperTextOutput(text: string): PaperTextOutput {
  const normalizedText = text.trim();
  try {
    const json = PaperStageJsonSchema.parse(JSON.parse(normalizedText));
    const normalizedBib = normalizeBibtex(json.bib);
    const sectionCitations = json.sections.map((section) => ({
      section: slugify(section.section),
      entries: section.entries.map((entry) => ({
        title: entry.title.trim(),
        citationKey: normalizeCitationKey(entry.citationKey),
        summary: entry.summary.trim(),
      })),
    }));
    const citeKeySet = new Set(normalizedBib.citeKeys);
    const missingCitationKeys = sectionCitations.flatMap((section) =>
      section.entries
        .map((entry) => entry.citationKey)
        .filter((citationKey) => !citeKeySet.has(citationKey))
        .map((citationKey) => `${section.section}:${citationKey}`),
    );
    if (missingCitationKeys.length > 0) {
      throw new Error(
        `Section citation markdown references cite keys that are missing from BibTeX: ${missingCitationKeys.join(", ")}`,
      );
    }
    return {
      bib: normalizedBib.bib,
      bibEntryKeys: normalizedBib.citeKeys,
      sectionCitations,
      sectionExemplars: [],
      literatureReviewMarkdown: undefined,
    };
  } catch (error) {
    if (!(error instanceof SyntaxError) && !(error instanceof z.ZodError)) {
      throw error;
    }
  }

  const bibMarker = "===BIB===";
  const papersMarker = "===PAPERS===";
  const exemplarsMarker = "===EXEMPLARS===";
  const literatureReviewMarker = "===LITERATURE_REVIEW===";
  const bibStart = text.indexOf(bibMarker);
  const papersStart = text.indexOf(papersMarker);
  const exemplarsStart = text.indexOf(exemplarsMarker);
  if (bibStart === -1 || papersStart === -1 || exemplarsStart === -1) {
    throw new Error(
      `Paper stage output must contain ${bibMarker}, ${papersMarker}, and ${exemplarsMarker} markers. Output was:\n${text}`,
    );
  }
  const bib = splitMarkedBlock(text, bibMarker, papersMarker);
  const papersMarkdown = splitMarkedBlock(text, papersMarker, exemplarsMarker);
  const exemplarsMarkdown = splitMarkedBlock(text, exemplarsMarker, literatureReviewMarker);
  const literatureReviewMarkdown = splitMarkedBlock(text, literatureReviewMarker) || undefined;
  if (bib.length === 0) {
    throw new Error(`BibTeX section is empty in paper stage output.`);
  }
  if (papersMarkdown.length === 0) {
    throw new Error(`Papers markdown section is empty in paper stage output.`);
  }
  if (exemplarsMarkdown.length === 0) {
    throw new Error(`Exemplars markdown section is empty in paper stage output.`);
  }
  const normalizedBib = normalizeBibtex(bib);
  const sectionCitations = parseSectionNotes(papersMarkdown);
  const sectionExemplars = parseExemplarPapers(exemplarsMarkdown);
  if (sectionCitations.length === 0) {
    throw new Error(`Failed to parse any section citations from paper stage output.`);
  }
  if (sectionExemplars.length === 0) {
    throw new Error(`Failed to parse any section exemplars from paper stage output.`);
  }
  const citeKeySet = new Set(normalizedBib.citeKeys);
  const missingCitationKeys = sectionCitations.flatMap((section) =>
    section.entries
      .map((entry) => entry.citationKey)
      .filter((citationKey) => !citeKeySet.has(citationKey))
      .map((citationKey) => `${section.section}:${citationKey}`),
  );
  if (missingCitationKeys.length > 0) {
    throw new Error(
      `Section citation markdown references cite keys that are missing from BibTeX: ${missingCitationKeys.join(", ")}`,
    );
  }
  const missingExemplarKeys = sectionExemplars.flatMap((section) =>
    section.papers
      .map((paper) => paper.citationKey)
      .filter((citationKey) => !citeKeySet.has(citationKey))
      .map((citationKey) => `${section.section}:${citationKey}`),
  );
  if (missingExemplarKeys.length > 0) {
    throw new Error(
      `Section exemplar markdown references cite keys that are missing from BibTeX: ${missingExemplarKeys.join(", ")}`,
    );
  }
  return {
    bib: normalizedBib.bib,
    bibEntryKeys: normalizedBib.citeKeys,
    sectionCitations,
    sectionExemplars,
    literatureReviewMarkdown:
      literatureReviewMarkdown && literatureReviewMarkdown.length > 0
        ? ensureTrailingLine(literatureReviewMarkdown)
        : undefined,
  };
}

export function shouldRetryWithoutPreviousResponse(error: unknown): boolean {
  if (error instanceof ResearchApiError) {
    return (
      error.code === "previous_response_not_found" ||
      error.param === "previous_response_id" ||
      /previous response/i.test(error.message)
    );
  }
  return error instanceof Error && /previous response/i.test(error.message);
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Expected JSON object in model output. Output was:\n${text}`);
  }
  return candidate.slice(start, end + 1);
}

export function parseStageOutput<T>(schema: z.ZodType<T>, text: string): T {
  const jsonText = extractJsonObject(text);
  const parsed = JSON.parse(jsonText) as unknown;
  return schema.parse(parsed);
}

function extractMarkdownDocument(text: string): string {
  const fenced = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i)?.[1];
  return ensureTrailingLine((fenced ?? text).trim());
}

function extractMarkdownSection(markdown: string, heading: string, level: 2 | 3): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const prefix = `${"#".repeat(level)} ${heading}`;
  const stopMatcher = new RegExp(`^#{1,${level}}\\s+`);
  let started = false;
  const captured: string[] = [];
  for (const line of lines) {
    if (!started) {
      if (line.trim() === prefix) {
        started = true;
      }
      continue;
    }
    if (stopMatcher.test(line)) {
      break;
    }
    captured.push(line);
  }
  return captured.join("\n").trim();
}

function parseMarkdownBullets(lines: string[]): string[] {
  return lines.map((line) => line.match(/^\s*-\s+(.*)$/)?.[1]?.trim() ?? "").filter(Boolean);
}

function parseLabeledLine(lines: string[], label: string): string {
  const matcher = new RegExp(`^\\s*-\\s*${escapeRegExp(label)}[：:]\\s*(.+)$`);
  return lines.map((line) => line.match(matcher)?.[1]?.trim() ?? "").find(Boolean) ?? "UNKNOWN";
}

export function parseWorkerStdoutBrief(stdout: string): ParsedWorkerStdoutBrief {
  const fields = new Map<string, string>();
  for (const rawLine of stdout.split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    fields.set(line.slice(0, separator).trim().toUpperCase(), line.slice(separator + 1).trim());
  }

  const result = (fields.get("RESULT") ?? "").toLowerCase();
  const summary = fields.get("SUMMARY") ?? "";
  const planUpdate = fields.get("PLAN_UPDATE") ?? "";
  const nextHint = fields.get("NEXT_HINT") ?? "";

  if (result !== "done" && result !== "blocked" && result !== "failed") {
    throw new Error(`Worker stdout is missing a valid RESULT line. Output was:\n${stdout}`);
  }
  if (summary.length === 0 || planUpdate.length === 0 || nextHint.length === 0) {
    throw new Error(
      `Worker stdout must contain non-empty SUMMARY, PLAN_UPDATE, and NEXT_HINT lines. Output was:\n${stdout}`,
    );
  }

  return {
    result,
    summary,
    planUpdate,
    nextHint,
  };
}

export function parseSourceSectionMarkdown(markdownInput: string): ParsedSourceSectionMarkdown {
  const markdown = extractMarkdownDocument(markdownInput);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const paperTitle = parseLabeledLine(lines, "paper_title");
  const citationKey = parseLabeledLine(lines, "citation_key");
  const sectionTitle = parseLabeledLine(lines, "section_title");
  const sectionSlug = parseLabeledLine(lines, "section_slug");

  if (
    paperTitle === "UNKNOWN" ||
    citationKey === "UNKNOWN" ||
    sectionTitle === "UNKNOWN" ||
    sectionSlug === "UNKNOWN"
  ) {
    throw new Error(`Source section markdown is missing required metadata fields.`);
  }

  return {
    citationKey,
    sectionTitle,
    sectionSlug: slugify(sectionSlug),
  };
}

function parseLabeledEntries(block: string, startLabel: string): Array<Record<string, string>> {
  const lines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const entries: string[][] = [];
  let current: string[] = [];
  const startMatcher = new RegExp(`^\\s*-\\s*${escapeRegExp(startLabel)}[：:]`);
  for (const line of lines) {
    if (startMatcher.test(line)) {
      if (current.length > 0) {
        entries.push(current);
      }
      current = [line];
      continue;
    }
    if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) {
    entries.push(current);
  }
  return entries.map((entryLines) => ({
    first: parseLabeledLine(entryLines, startLabel),
    second: parseLabeledLine(entryLines, startLabel === "路径" ? "用途" : "地址"),
    third: parseLabeledLine(entryLines, startLabel === "路径" ? "用途" : "备注"),
  }));
}

export function parseSpecificationMarkdown(markdownInput: string): {
  specification: ResearchSpecification;
  markdown: string;
} {
  const markdown = extractMarkdownDocument(markdownInput);
  const problem = extractMarkdownSection(markdown, "问题定义", 2);
  const scope = extractMarkdownSection(markdown, "范围", 2);
  const method = parseMarkdownBullets(extractMarkdownSection(markdown, "方法", 2).split("\n"));
  const evaluation = parseMarkdownBullets(extractMarkdownSection(markdown, "评估", 2).split("\n"));
  const risks = parseMarkdownBullets(extractMarkdownSection(markdown, "风险", 2).split("\n"));
  const resourcesBlock = extractMarkdownSection(markdown, "资源", 2);
  const backboneBlock = extractMarkdownSection(resourcesBlock, "Backbone", 3);
  const datasetBlock = extractMarkdownSection(resourcesBlock, "数据集", 3);
  const baselinesBlock = extractMarkdownSection(resourcesBlock, "对比方法", 3);
  const executionBlock = extractMarkdownSection(markdown, "执行说明", 2);
  const environmentBlock = extractMarkdownSection(executionBlock, "环境", 3);
  const entrypointsBlock = extractMarkdownSection(executionBlock, "入口", 3);
  const prepareBlock = extractMarkdownSection(executionBlock, "数据准备命令", 3);
  const trainBlock = extractMarkdownSection(executionBlock, "训练命令", 3);
  const evaluateBlock = extractMarkdownSection(executionBlock, "评估命令", 3);
  const artifactsBlock = extractMarkdownSection(executionBlock, "预期产物", 3);

  const datasetEntries = parseLabeledEntries(datasetBlock, "名称").map((entry) => ({
    name: entry.first,
    url: entry.second,
    notes: entry.third,
  }));
  const baselineEntries = parseLabeledEntries(baselinesBlock, "名称").map((entry) => ({
    name: entry.first,
    url: entry.second,
    notes: entry.third,
  }));
  const entrypointEntries = parseLabeledEntries(entrypointsBlock, "路径").map((entry) => ({
    path: entry.first,
    purpose: entry.second,
  }));

  if (
    problem.length === 0 ||
    scope.length === 0 ||
    method.length === 0 ||
    evaluation.length === 0 ||
    risks.length === 0 ||
    datasetEntries.length === 0 ||
    baselineEntries.length === 0 ||
    entrypointEntries.length === 0
  ) {
    throw new Error(`Failed to parse specification markdown. Output was:\n${markdown}`);
  }

  return {
    specification: {
      problem,
      scope,
      method,
      evaluation,
      risks,
      resources: {
        backbone: {
          name: parseLabeledLine(backboneBlock.split("\n"), "名称"),
          url: parseLabeledLine(backboneBlock.split("\n"), "地址"),
          notes: parseLabeledLine(backboneBlock.split("\n"), "备注"),
        },
        datasets: datasetEntries,
        baselines: baselineEntries,
      },
      execution: {
        environment: parseMarkdownBullets(environmentBlock.split("\n")),
        entrypoints: entrypointEntries,
        commands: {
          prepare: parseMarkdownBullets(prepareBlock.split("\n")),
          train: parseMarkdownBullets(trainBlock.split("\n")),
          evaluate: parseMarkdownBullets(evaluateBlock.split("\n")),
        },
        expectedArtifacts: parseMarkdownBullets(artifactsBlock.split("\n")),
      },
    },
    markdown,
  };
}

function parseMarkdownSections(markdown: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentSection: string | null = null;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  for (const line of lines.slice(1)) {
    const header = line.match(/^##\s+(.+)$/);
    if (header?.[1]) {
      currentSection = header[1].trim();
      sections.set(currentSection, []);
      continue;
    }
    if (currentSection) {
      sections.get(currentSection)?.push(line);
    }
  }
  return sections;
}

function trimMarkdownSection(lines: string[] | undefined): string {
  return (lines ?? []).join("\n").trim();
}

function parseWorkerType(raw: string, source: string): ResearchTaskWorkerType {
  if (raw === "coding" || raw === "writing") {
    return raw;
  }
  throw new Error(`Invalid worker type in ${source}: ${raw || "<empty>"}`);
}

function parseTopLevelTodoId(rawLabel: string): string {
  const normalized = rawLabel.trim();
  const taskLabelMatch = normalized.match(/^task_(\d+)$/i);
  if (taskLabelMatch?.[1]) {
    return `T${taskLabelMatch[1].padStart(2, "0")}`;
  }
  const taskIdMatch = normalized.match(/^T(\d+)$/i);
  if (taskIdMatch?.[1]) {
    return `T${taskIdMatch[1].padStart(2, "0")}`;
  }
  throw new Error(`Invalid top-level todo item id: ${rawLabel}`);
}

export function parseTopLevelTodoMarkdown(markdownInput: string): ResearchTodoItem[] {
  const markdown = extractMarkdownDocument(markdownInput);
  const items = markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ["))
    .map((line) => {
      const match = line.match(
        /^-\s+\[([ xX])\]\s+([^\s]+)\s+—\s+\*\*(coding|writing)\*\*\s+—\s+(.+?)(?:\s+\(`([^`]+)`\))?$/,
      );
      if (!match?.[1] || !match[2] || !match[3] || !match[4]) {
        throw new Error(`Invalid top-level todo item line: ${line}`);
      }
      return {
        id: parseTopLevelTodoId(match[2]),
        title: match[4].trim(),
        workerType: parseWorkerType(match[3], "top-level todo"),
        objective: "",
        acceptance: [],
        status: match[1].toLowerCase() === "x" ? "done" : "pending",
        subtasksDir: match[5]?.trim() ?? "",
      } satisfies ResearchTodoItem;
    });

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
  return items;
}

function parsePlanItemStatus(raw: string, source: string): ResearchPlanItemStatus {
  if (raw === "done" || raw === "in_progress" || raw === "pending") {
    return raw;
  }
  throw new Error(`Invalid plan item status in ${source}: ${raw || "<empty>"}`);
}

function parseSingleSentenceLine(raw: string, label: string, taskPath: string): string {
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    throw new Error(`${label} must not be empty in ${taskPath}`);
  }
  if (normalized === "暂无" || normalized === "none") {
    return normalized;
  }
  if (countSentences(normalized) !== 1) {
    throw new Error(`${label} must be exactly one sentence in ${taskPath}`);
  }
  return normalized;
}

function parseBulletLines(lines: string[], sectionName: string, taskPath: string): string[] {
  const results: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const match = trimmed.match(/^-\s+(.+)$/);
    if (!match?.[1]) {
      throw new Error(`${sectionName} in ${taskPath} must use bullet list entries only.`);
    }
    results.push(match[1].trim());
  }
  return results;
}

function splitPlanItemBlocks(lines: string[], sectionName: string, taskPath: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      if (current.length > 0) {
        current.push(line);
      }
      continue;
    }
    if (/^###\s+/.test(trimmed)) {
      if (current.length > 0) {
        blocks.push(current);
      }
      current = [line];
      continue;
    }
    if (current.length === 0) {
      throw new Error(`${sectionName} in ${taskPath} must not contain prose before an item id.`);
    }
    current.push(line);
  }
  if (current.length > 0) {
    blocks.push(current);
  }
  return blocks;
}

function parseStepList(lines: string[], taskPath: string) {
  const blocks = splitPlanItemBlocks(lines, "Step List", taskPath);
  return blocks.map((block) => {
    const heading = block[0]?.trim().match(/^###\s+([A-Za-z0-9_-]+)$/)?.[1];
    if (!heading) {
      throw new Error(`Step List item is missing a stable id heading in ${taskPath}`);
    }
    const body = block.slice(1).map((line) => line.trim()).filter(Boolean);
    const status = parsePlanItemStatus(parseLabeledLine(body, "status"), taskPath);
    const task = parseLabeledLine(body, "task");
    const acceptance = parseLabeledLine(body, "acceptance");
    if (task === "UNKNOWN" || acceptance === "UNKNOWN") {
      throw new Error(`Step List item ${heading} is missing required fields in ${taskPath}`);
    }
    const unexpected = body.filter((line) => !/^-+\s*(status|task|acceptance)\s*[:：]\s+.+$/.test(line));
    if (unexpected.length > 0) {
      throw new Error(`Step List item ${heading} in ${taskPath} must stay structured, not prose.`);
    }
    return { id: heading, status, task, acceptance };
  });
}

function parseSectionQueue(
  lines: string[],
  layoutSections: readonly ResearchLayoutSection[],
  taskPath: string,
) {
  const layoutById = new Map(layoutSections.map((section) => [section.id, section] as const));
  const blocks = splitPlanItemBlocks(lines, "Section Queue", taskPath);
  const parsed = blocks.map((block) => {
    const heading = block[0]?.trim().match(/^###\s+([A-Za-z0-9_-]+)$/)?.[1];
    if (!heading) {
      throw new Error(`Section Queue item is missing a stable id heading in ${taskPath}`);
    }
    const body = block.slice(1).map((line) => line.trim()).filter(Boolean);
    const status = parsePlanItemStatus(parseLabeledLine(body, "status"), taskPath);
    const sectionId = parseLabeledLine(body, "section_id");
    const sectionSlug = parseLabeledLine(body, "section_slug");
    const materialsDir = parseLabeledLine(body, "materials_dir");
    const manuscriptPath = parseLabeledLine(body, "manuscript_path");
    const acceptance = parseLabeledLine(body, "acceptance");
    if (
      sectionId === "UNKNOWN" ||
      sectionSlug === "UNKNOWN" ||
      materialsDir === "UNKNOWN" ||
      manuscriptPath === "UNKNOWN" ||
      acceptance === "UNKNOWN"
    ) {
      throw new Error(`Section Queue item ${heading} is missing required fields in ${taskPath}`);
    }
    const unexpected = body.filter(
      (line) =>
        !/^-+\s*(status|section_id|section_slug|materials_dir|manuscript_path|acceptance)\s*[:：]\s+.+$/.test(
          line,
        ),
    );
    if (unexpected.length > 0) {
      throw new Error(`Section Queue item ${heading} in ${taskPath} must stay structured, not prose.`);
    }
    return {
      id: heading,
      status,
      sectionId,
      sectionSlug: slugify(sectionSlug),
      materialsDir,
      manuscriptPath,
      acceptance,
    };
  });
  if (parsed.length !== layoutSections.length) {
    throw new Error(
      `Section Queue in ${taskPath} must include every layout section exactly once and in order.`,
    );
  }
  parsed.forEach((item, index) => {
    const expectedLayout = layoutSections[index];
    const expectedQueueId = `W${String(index + 1).padStart(2, "0")}`;
    if (!expectedLayout) {
      throw new Error(`Section Queue in ${taskPath} references unexpected extra items.`);
    }
    if (item.id !== expectedQueueId) {
      throw new Error(`Section Queue in ${taskPath} must use fixed ids ${expectedQueueId} in layout order.`);
    }
    const layout = layoutById.get(item.sectionId);
    if (!layout) {
      throw new Error(`Section Queue item ${item.id} in ${taskPath} references unknown section_id ${item.sectionId}.`);
    }
    if (item.sectionId !== expectedLayout.id || item.sectionSlug !== expectedLayout.slug) {
      throw new Error(`Section Queue in ${taskPath} must follow layout.md section order without reordering.`);
    }
    if (item.materialsDir !== expectedLayout.materialsDir) {
      throw new Error(`Section Queue item ${item.id} in ${taskPath} has materials_dir mismatch with layout.md.`);
    }
    if (item.manuscriptPath !== expectedLayout.manuscriptTex) {
      throw new Error(`Section Queue item ${item.id} in ${taskPath} has manuscript_path mismatch with layout.md.`);
    }
  });
  return parsed;
}

export function parseLayoutMarkdown(markdownInput: string): ResearchLayoutSection[] {
  const markdown = extractMarkdownDocument(markdownInput);
  const sectionLayout = extractMarkdownSection(markdown, "Section Layout", 2);
  const blocks = sectionLayout
    .split(/^###\s+/m)
    .map((block) => block.trim())
    .filter(Boolean);
  const sections = blocks.map((block) => {
    const [rawHeading, ...bodyLines] = block.split("\n");
    const heading = rawHeading?.trim().match(/^([A-Za-z0-9_-]+)\s+(.+)$/);
    if (!heading?.[1] || !heading[2]) {
      throw new Error(`Invalid layout section heading: ${rawHeading ?? "<empty>"}`);
    }
    const body = bodyLines.map((line) => line.trim()).filter(Boolean);
    const slug = slugify(parseLabeledLine(body, "section_slug"));
    const materialsDir = parseLabeledLine(body, "materials_dir");
    const citationsFile = parseLabeledLine(body, "citations_file");
    const briefFile = parseLabeledLine(body, "brief_file");
    const manuscriptTex = parseLabeledLine(body, "manuscript_tex");
    if (
      slug === "unknown" ||
      materialsDir === "UNKNOWN" ||
      citationsFile === "UNKNOWN" ||
      briefFile === "UNKNOWN" ||
      manuscriptTex === "UNKNOWN"
    ) {
      throw new Error(`Layout section ${heading[1]} is missing required path fields.`);
    }
    return {
      id: heading[1],
      slug,
      materialsDir,
      citationsFile,
      briefFile,
      manuscriptTex,
    };
  });
  if (sections.length === 0) {
    throw new Error(`layout.md must define at least one section under ## Section Layout.`);
  }
  return sections;
}

export function parseTaskPlanMarkdown(params: {
  content: string;
  taskDir: string;
  taskPath: string;
  layoutContent?: string;
}): ParsedTaskPlan {
  const firstLine = params.content.replace(/\r\n/g, "\n").split("\n")[0]?.trim() ?? "";
  const heading = firstLine.match(/^#\s+(T\d+)\s+(.+)$/);
  if (!heading?.[1] || !heading[2]) {
    throw new Error(`Invalid task plan heading in ${params.taskPath}`);
  }
  if (params.content.trim().length === 0) {
    throw new Error(`Task plan must not be empty in ${params.taskPath}`);
  }
  const sections = parseMarkdownSections(params.content);
  const workerType = parseWorkerType(
    trimMarkdownSection(sections.get("Worker Type")),
    params.taskPath,
  );
  const rawStatus = trimMarkdownSection(sections.get("状态"));
  const status = parsePlanItemStatus(rawStatus || "pending", params.taskPath);
  const objective = trimMarkdownSection(sections.get("目标"));
  const acceptance = parseBulletLines(sections.get("验收标准") ?? [], "验收标准", params.taskPath);
  const blockers = parseBulletLines(sections.get("Blockers") ?? [], "Blockers", params.taskPath);
  const lastRunResult = parseSingleSentenceLine(
    parseBulletLines(sections.get("最近执行结果") ?? [], "最近执行结果", params.taskPath)[0] ?? "",
    "最近执行结果",
    params.taskPath,
  );
  const nextActionHint = parseSingleSentenceLine(
    parseBulletLines(sections.get("Next Action Hint") ?? [], "Next Action Hint", params.taskPath)[0] ??
      "",
    "Next Action Hint",
    params.taskPath,
  );

  const steps = workerType === "coding" ? parseStepList(sections.get("Step List") ?? [], params.taskPath) : [];
  const layoutSections =
    workerType === "writing"
      ? parseLayoutMarkdown(params.layoutContent ?? "")
      : [];
  const sectionQueue =
    workerType === "writing"
      ? parseSectionQueue(sections.get("Section Queue") ?? [], layoutSections, params.taskPath)
      : [];

  if (workerType === "coding" && steps.length === 0) {
    throw new Error(`Coding task plan in ${params.taskPath} must include a non-empty Step List.`);
  }
  if (workerType === "writing" && sectionQueue.length === 0) {
    throw new Error(`Writing task plan in ${params.taskPath} must include a non-empty Section Queue.`);
  }
  return {
    id: heading[1],
    title: heading[2].trim(),
    workerType,
    status,
    objective,
    acceptance,
    steps,
    sectionQueue,
    blockers,
    lastRunResult,
    nextActionHint,
    dir: params.taskDir,
    path: params.taskPath,
  };
}
