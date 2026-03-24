import fs from "node:fs/promises";
import path from "node:path";
import type {
  ParsedResearchSectionBrief,
  ParsedTaskPlan,
  ResearchTaskPlanSectionQueueItem,
  ResearchWritingSectionTaskPackage,
} from "./types.js";

function readLabeledValue(line: string, label: string): string | undefined {
  return line.match(new RegExp(`^\\s*-\\s*${label}[：:]\\s*(.+)$`))?.[1]?.trim();
}

export function parseSectionBriefMarkdown(markdown: string): ParsedResearchSectionBrief {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sourceSectionPaths: string[] = [];
  const sourceSectionCitationKeys: string[] = [];
  const experimentResultPaths: string[] = [];
  const existingTexPaths: string[] = [];
  let currentSection = "";
  let collectingExperimentPaths = false;
  let collectingExistingTexPaths = false;

  let sectionId: string | undefined;
  let sectionTitle: string | undefined;
  let writingGoal: string | undefined;
  let latexOutputPath: string | undefined;
  let referencesBibPath: string | undefined;
  let literatureReviewPath: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    const sectionHeader = trimmed.match(/^##\s+(.+)$/)?.[1]?.trim();
    if (sectionHeader) {
      currentSection = sectionHeader;
      collectingExperimentPaths = false;
      collectingExistingTexPaths = false;
      continue;
    }

    sectionId ??= readLabeledValue(trimmed, "section_id");
    sectionTitle ??= readLabeledValue(trimmed, "section_title");
    writingGoal ??= readLabeledValue(trimmed, "writing_goal");
    latexOutputPath ??= readLabeledValue(trimmed, "latex_output_path");

    if (currentSection === "Source Section Mapping") {
      const sourceSectionPath = readLabeledValue(trimmed, "source_section_path");
      if (sourceSectionPath) {
        sourceSectionPaths.push(sourceSectionPath);
        continue;
      }
      const citationKey = readLabeledValue(trimmed, "citation_key");
      if (citationKey) {
        sourceSectionCitationKeys.push(citationKey);
      }
      continue;
    }

    if (currentSection !== "Additional Reads") {
      continue;
    }

    const referencesPath = readLabeledValue(trimmed, "references_bib");
    if (referencesPath) {
      referencesBibPath = referencesPath;
      collectingExperimentPaths = false;
      collectingExistingTexPaths = false;
      continue;
    }
    const reviewPath = readLabeledValue(trimmed, "literature_review");
    if (reviewPath) {
      literatureReviewPath = reviewPath;
      collectingExperimentPaths = false;
      collectingExistingTexPaths = false;
      continue;
    }
    if (/^-\s*experiment_result_paths\s*[:：]\s*none$/i.test(trimmed)) {
      collectingExperimentPaths = false;
      continue;
    }
    if (/^-\s*experiment_result_paths\s*[:：]\s*$/i.test(trimmed)) {
      collectingExperimentPaths = true;
      collectingExistingTexPaths = false;
      continue;
    }
    if (/^-\s*existing_tex_paths\s*[:：]\s*none$/i.test(trimmed)) {
      collectingExistingTexPaths = false;
      continue;
    }
    if (/^-\s*existing_tex_paths\s*[:：]\s*$/i.test(trimmed)) {
      collectingExistingTexPaths = true;
      collectingExperimentPaths = false;
      continue;
    }
    const listEntry = trimmed.match(/^-\s+(.+)$/)?.[1]?.trim();
    if (collectingExperimentPaths && listEntry) {
      experimentResultPaths.push(listEntry);
      continue;
    }
    if (collectingExistingTexPaths && listEntry) {
      existingTexPaths.push(listEntry);
      continue;
    }
    collectingExperimentPaths = false;
    collectingExistingTexPaths = false;
  }

  return {
    sectionId,
    sectionTitle,
    writingGoal,
    latexOutputPath,
    sourceSectionPaths,
    sourceSectionCitationKeys,
    referencesBibPath,
    literatureReviewPath,
    experimentResultPaths,
    existingTexPaths,
  };
}

function containsGlobPattern(target: string): boolean {
  return /[*?[\]{}]/.test(target);
}

async function collectMatchedPaths(workspaceDir: string, pattern: string): Promise<string[]> {
  if (!containsGlobPattern(pattern)) {
    try {
      await fs.access(path.join(workspaceDir, pattern));
      return [pattern];
    } catch {
      return [];
    }
  }

  const normalized = pattern.replace(/\\/g, "/");
  if (normalized === "tasks/*/outputs/result.json") {
    const tasksDir = path.join(workspaceDir, "tasks");
    const taskIds = await fs.readdir(tasksDir).catch(() => []);
    const matched = await Promise.all(
      taskIds.map(async (taskId) => {
        const candidate = path.join(tasksDir, taskId, "outputs", "result.json");
        try {
          await fs.access(candidate);
          return path.relative(workspaceDir, candidate).replace(/\\/g, "/");
        } catch {
          return undefined;
        }
      }),
    );
    return matched.filter((entry): entry is string => Boolean(entry)).sort();
  }

  return [];
}

async function collectCitationKeysFromCitationsFile(
  workspaceDir: string,
  citationsPath: string | undefined,
): Promise<string[]> {
  if (!citationsPath) {
    return [];
  }
  const content = await fs.readFile(path.join(workspaceDir, citationsPath), "utf-8").catch(() => "");
  return [...content.matchAll(/^\s*-\s*cite_key:\s*(.+)$/gm)]
    .map((match) => match[1]?.trim())
    .filter((entry): entry is string => Boolean(entry));
}

export function resolveWritingTaskPackageRelativePath(
  taskDir: string,
  queueItemId: string,
): string {
  return path.posix.join(taskDir.replace(/\\/g, "/"), "writing_packages", `${queueItemId}.md`);
}

export async function buildWritingSectionTaskPackage(params: {
  workspaceDir: string;
  task: ParsedTaskPlan;
  queueItem: ResearchTaskPlanSectionQueueItem;
}): Promise<ResearchWritingSectionTaskPackage> {
  const briefPath = path.posix.join(params.queueItem.materialsDir, "brief.md");
  const citationsPath = path.posix.join(params.queueItem.materialsDir, "citations.md");
  const brief = parseSectionBriefMarkdown(
    await fs.readFile(path.join(params.workspaceDir, briefPath), "utf-8"),
  );
  const resultJsonPaths = (
    await Promise.all(
      brief.experimentResultPaths.map(async (entry) => await collectMatchedPaths(params.workspaceDir, entry)),
    )
  ).flat();
  const summaryPaths = resultJsonPaths
    .map((entry) =>
      entry.endsWith("/outputs/result.json") ? entry.replace(/\/outputs\/result\.json$/, "/summary.md") : undefined,
    )
    .filter((entry): entry is string => Boolean(entry));
  const citationKeys = new Set(brief.sourceSectionCitationKeys);
  for (const citeKey of await collectCitationKeysFromCitationsFile(params.workspaceDir, citationsPath)) {
    citationKeys.add(citeKey);
  }

  return {
    taskId: params.task.id,
    queueItemId: params.queueItem.id,
    sectionId: params.queueItem.sectionId,
    sectionSlug: params.queueItem.sectionSlug,
    briefPath,
    sourceSectionPaths: brief.sourceSectionPaths,
    outputTexPath: params.queueItem.manuscriptPath,
    planPath: path.posix.join(params.task.dir, "plan.md"),
    resultJsonPaths,
    summaryPaths,
    citationKeys: [...citationKeys].sort(),
    referencesBibPath:
      brief.referencesBibPath && brief.referencesBibPath.toLowerCase() !== "none"
        ? brief.referencesBibPath
        : undefined,
    citationsPath,
    literatureReviewPath:
      brief.literatureReviewPath && brief.literatureReviewPath.toLowerCase() !== "none"
        ? brief.literatureReviewPath
        : undefined,
    existingTexPaths: brief.existingTexPaths,
  };
}

export function renderWritingSectionTaskPackageMarkdown(
  taskPackage: ResearchWritingSectionTaskPackage,
): string {
  const lines = [
    `# ${taskPackage.queueItemId} Writing Task Package`,
    "",
    `- task_id: ${taskPackage.taskId}`,
    `- queue_item_id: ${taskPackage.queueItemId}`,
    `- section_id: ${taskPackage.sectionId}`,
    `- section_slug: ${taskPackage.sectionSlug}`,
    `- brief_path: ${taskPackage.briefPath}`,
    `- output_tex_path: ${taskPackage.outputTexPath}`,
    `- plan_path: ${taskPackage.planPath}`,
    "",
    "## Required Reads",
    "",
    "- agents/writing/AGENTS.md",
    `- ${taskPackage.briefPath}`,
    ...taskPackage.sourceSectionPaths.map((entry) => `- ${entry}`),
    "",
    "## Optional Reads",
    "",
    `- references_bib: ${taskPackage.referencesBibPath ?? "none"}`,
    `- citations_md: ${taskPackage.citationsPath ?? "none"}`,
    `- literature_review: ${taskPackage.literatureReviewPath ?? "none"}`,
  ];
  if (taskPackage.resultJsonPaths.length === 0) {
    lines.push("- result_json_paths: none");
  } else {
    lines.push("- result_json_paths:");
    taskPackage.resultJsonPaths.forEach((entry) => lines.push(`  - ${entry}`));
  }
  if (taskPackage.summaryPaths.length === 0) {
    lines.push("- summary_paths: none");
  } else {
    lines.push("- summary_paths:");
    taskPackage.summaryPaths.forEach((entry) => lines.push(`  - ${entry}`));
  }
  if (taskPackage.existingTexPaths.length === 0) {
    lines.push("- existing_tex_paths: none");
  } else {
    lines.push("- existing_tex_paths:");
    taskPackage.existingTexPaths.forEach((entry) => lines.push(`  - ${entry}`));
  }
  lines.push("");
  lines.push("## Citation Keys");
  lines.push("");
  lines.push(
    taskPackage.citationKeys.length === 0
      ? "- citation_keys: none"
      : `- citation_keys: ${taskPackage.citationKeys.join(", ")}`,
  );
  lines.push("");
  lines.push("## Constraints");
  lines.push("");
  lines.push("- 本轮只写当前 section，不允许跨 section 发散。");
  lines.push("- source section Markdown 只允许读取本任务包列出的文件。");
  lines.push("- 正式引用链路与榜样论文风格链路分开处理。");
  return `${lines.join("\n").trimEnd()}\n`;
}

export async function writeWritingSectionTaskPackage(params: {
  workspaceDir: string;
  task: ParsedTaskPlan;
  queueItem: ResearchTaskPlanSectionQueueItem;
}): Promise<{ relativePath: string; taskPackage: ResearchWritingSectionTaskPackage }> {
  const taskPackage = await buildWritingSectionTaskPackage(params);
  const relativePath = resolveWritingTaskPackageRelativePath(params.task.dir, params.queueItem.id);
  const absolutePath = path.join(params.workspaceDir, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, renderWritingSectionTaskPackageMarkdown(taskPackage), "utf-8");
  return { relativePath, taskPackage };
}

export function validateLatexSectionSanity(params: {
  content: string;
  manuscriptPath: string;
}): string | undefined {
  const text = params.content.trim();
  if (text.length === 0) {
    return `${params.manuscriptPath} 为空，Writing 必须写出非空 LaTeX。`;
  }
  if (/^#\s+/m.test(text)) {
    return `${params.manuscriptPath} 看起来仍是 Markdown 标题，不是 LaTeX section 文件。`;
  }
  if (!/\\(?:section|subsection|subsubsection|paragraph|begin\{abstract\}|noindent\b)/.test(text)) {
    return `${params.manuscriptPath} 缺少基本 LaTeX 结构命令。`;
  }
  const openCount = (text.match(/\{/g) ?? []).length;
  const closeCount = (text.match(/\}/g) ?? []).length;
  if (openCount !== closeCount) {
    return `${params.manuscriptPath} 的花括号数量不平衡，未通过基本 LaTeX sanity check。`;
  }
  return undefined;
}
