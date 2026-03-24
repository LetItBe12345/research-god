import fs from "node:fs/promises";
import path from "node:path";
import { callGatewayFromCli } from "../cli/gateway-rpc.js";
import {
  defaultOutputRoot,
  defaultTickWorkspace,
  readIdeaInput,
  resolveCount,
  resolveModel,
  resolveThinking,
} from "../research/config.js";
import { resolveWorkspaceDispatch } from "../research/dispatcher.js";
import { buildDryRunResult } from "../research/dry-run.js";
import {
  launchPreparedLongResearchJob,
  LONG_JOB_WAKE_TEXT,
  researchSuperviseJobCommand,
  startDetachedLongResearchJobSupervisor,
  tryReadResearchLongJob,
  validatePreparedLongJobArtifacts,
  isActiveLongJob,
  isPreparedLongJob,
} from "../research/jobs.js";
import { materializeExemplarPapers } from "../research/papers.js";
import {
  parseLayoutMarkdown,
  parseSpecificationMarkdown,
  parseStageOutput,
  parseTaskPlanMarkdown,
  parsePaperTextOutput,
} from "../research/parsing.js";
import { runStage, runStageWithContextFallback } from "../research/pipeline.js";
import {
  buildIdeaPrompt,
  buildPaperPrompt,
  buildPaperPromptWithContext,
  buildSpecificationPrompt,
  buildSpecificationPromptWithContext,
  buildTodoPrompt,
  buildTodoPromptWithContext,
  buildWritingStructurePrompt,
  buildWritingStructurePromptWithContext,
} from "../research/prompts.js";
import {
  formatResultSummary,
  formatTickSummary,
  renderIdeaMarkdown,
  renderLayoutMarkdown,
  renderLiteratureReviewMarkdown,
  renderRoleAgentsMarkdown,
  renderSectionCitationsMarkdown,
  renderTaskPlanMarkdown,
  renderTopLevelTodoMarkdown,
  renderWorkspaceAgentsMarkdown,
} from "../research/render.js";
import {
  archiveTaskPlanSnapshot,
  buildTaskPrompt,
  defaultRoleRunner,
  readWorkspaceState,
  resolveParsedTaskStatus,
  writeTaskPlanIfChanged,
  writeWorkspaceState,
} from "../research/roles.js";
import { alignSectionExemplars } from "../research/section-materials.js";
import { slugify } from "../research/shared.js";
import {
  IdeaStageSchema,
  RESEARCH_MODELS,
  RESEARCH_RESPONSE_MODES,
  RESEARCH_ROLE_NAMES,
  RESEARCH_STAGE_NAMES,
  RESEARCH_THINKING_LEVELS,
  TodoStageSchema,
  WritingStructureStageSchema,
  type ResearchModel,
  type ResearchRoleName,
  type ResearchRoleResult,
  type ResearchRunOptions,
  type ResearchRunResult,
  type ResearchSuperviseJobOptions,
  type ResearchSection,
  type ResearchWritingStructureSection,
  type ResearchArtifactCollections,
  type ResearchExemplarPaper,
  type ResearchStageName,
  type ResearchThinkingLevel,
  type ResearchTickOptions,
  type ResearchTickResult,
  type ResearchTodoItem,
  type ResearchReport,
} from "../research/types.js";
import {
  initializeTaskArtifactScaffold,
  initializeSectionArtifacts,
  initializeResearchWorkspace,
  migrateLegacyResearchWorkspace,
  resolveResearchWorkspacePaths,
  resolveRoleWorkspaceDir,
  resolveTaskArtifactPaths,
  validateManuscriptTemplate,
} from "../research/workspace.js";
import { validateLatexSectionSanity, writeWritingSectionTaskPackage } from "../research/writing.js";
import type { RuntimeEnv } from "../runtime.js";

export {
  RESEARCH_MODELS,
  RESEARCH_RESPONSE_MODES,
  RESEARCH_ROLE_NAMES,
  RESEARCH_STAGE_NAMES,
  RESEARCH_THINKING_LEVELS,
};
export type {
  ResearchModel,
  ResearchRoleName,
  ResearchRoleResult,
  ResearchRunOptions,
  ResearchRunResult,
  ResearchSuperviseJobOptions,
  ResearchStageName,
  ResearchThinkingLevel,
  ResearchTickOptions,
  ResearchTickResult,
} from "../research/types.js";

export const RESEARCH_RUN_WAKE_TEXT =
  "Research stage completed. Read AGENTS.md, specification.md, todo.md, layout.md, and incomplete task plan.md files under tasks/. Select exactly one next action.";

function alignSectionCitationMarkdown(params: {
  sections: ResearchSection[];
  parsedSections: ReadonlyArray<{
    section: string;
    entries: Array<{ title: string; citationKey: string; summary: string }>;
  }>;
}): Map<string, string> {
  const parsedBySlug = new Map(
    params.parsedSections.map((section) => [slugify(section.section), section.entries] as const),
  );
  return new Map(
    params.sections.map((section) => {
      const slug = slugify(section.name);
      return [slug, renderSectionCitationsMarkdown(slug, parsedBySlug.get(slug) ?? [])] as const;
    }),
  );
}

function alignWritingStructureSections(params: {
  sections: ResearchSection[];
  writingStructure: ReadonlyArray<ResearchWritingStructureSection>;
}): ResearchWritingStructureSection[] {
  const byId = new Map(
    params.writingStructure.map((section) => [section.id, section] as const),
  );
  if (byId.size !== params.writingStructure.length) {
    throw new Error("writing_structure stage returned duplicate section ids.");
  }
  if (params.writingStructure.length !== params.sections.length) {
    throw new Error(
      `writing_structure stage must return exactly ${params.sections.length} sections; received ${params.writingStructure.length}.`,
    );
  }

  return params.sections.map((section) => {
    const matched = byId.get(section.id);
    if (!matched) {
      throw new Error(`writing_structure stage is missing section ${section.id}.`);
    }
    const expectedName = slugify(section.name);
    const receivedName = slugify(matched.name);
    if (receivedName !== expectedName) {
      throw new Error(
        `writing_structure stage changed section ${section.id} name from ${expectedName} to ${receivedName}.`,
      );
    }
    return {
      ...matched,
      id: section.id,
      name: expectedName,
      keyPoints: [...matched.keyPoints],
      questionsToAnswer: [...matched.questionsToAnswer],
      avoidPatterns: [...matched.avoidPatterns],
      requiredContext: [...new Set(matched.requiredContext)],
    };
  });
}

async function readFileOrEmpty(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8").catch(() => "");
}

async function validateCodingTaskArtifacts(params: {
  workspaceDir: string;
  taskDir: string;
  planBeforeRun: string;
  summaryBeforeRun: string;
  resultBeforeRun: string;
  runLogBeforeRun: string;
}): Promise<void> {
  const paths = resolveTaskArtifactPaths(params.workspaceDir, params.taskDir);
  const [planAfterRun, summaryAfterRun, resultAfterRun, runLogAfterRun] = await Promise.all([
    readFileOrEmpty(paths.planPath),
    readFileOrEmpty(paths.summaryPath),
    readFileOrEmpty(paths.resultJsonPath),
    readFileOrEmpty(paths.runLogPath),
  ]);

  if (planAfterRun === params.planBeforeRun) {
    throw new Error(`coding_agent must update ${params.taskDir}/plan.md before exiting.`);
  }
  if (summaryAfterRun.trim().length === 0 || summaryAfterRun === params.summaryBeforeRun) {
    throw new Error(`coding_agent must update ${params.taskDir}/summary.md before exiting.`);
  }
  if (resultAfterRun.trim().length === 0 || resultAfterRun === params.resultBeforeRun) {
    throw new Error(
      `coding_agent must update ${params.taskDir}/outputs/result.json before exiting.`,
    );
  }
  try {
    JSON.parse(resultAfterRun);
  } catch (error) {
    throw new Error(`coding_agent wrote invalid JSON to ${params.taskDir}/outputs/result.json.`, {
      cause: error,
    });
  }
  if (runLogAfterRun === params.runLogBeforeRun) {
    throw new Error(`coding_agent must append ${params.taskDir}/logs/run.log before exiting.`);
  }
}

async function validateWritingTaskArtifacts(params: {
  workspaceDir: string;
  taskDir: string;
  planBeforeRun: string;
  manuscriptPath: string;
  manuscriptBeforeRun: string;
}): Promise<void> {
  const paths = resolveTaskArtifactPaths(params.workspaceDir, params.taskDir);
  const [planAfterRun, manuscriptAfterRun] = await Promise.all([
    readFileOrEmpty(paths.planPath),
    readFileOrEmpty(path.join(params.workspaceDir, params.manuscriptPath)),
  ]);

  if (planAfterRun === params.planBeforeRun) {
    throw new Error(`writing_agent must update ${params.taskDir}/plan.md before exiting.`);
  }
  if (manuscriptAfterRun.trim().length === 0 || manuscriptAfterRun === params.manuscriptBeforeRun) {
    throw new Error(
      `writing_agent must update ${params.manuscriptPath.replace(/\\/g, "/")} before exiting.`,
    );
  }
  const latexIssue = validateLatexSectionSanity({
    content: manuscriptAfterRun,
    manuscriptPath: params.manuscriptPath.replace(/\\/g, "/"),
  });
  if (latexIssue) {
    throw new Error(latexIssue);
  }
}

function buildArtifactCollections(params: {
  bibEntryKeys: readonly string[];
  literatureReviewIncluded: boolean;
}): ResearchArtifactCollections {
  return {
    references: {
      description:
        "待引用文献集合。`references.bib` 与各 section 的 `citations.md` 是同一集合的不同载体，用于正式引用、related work 和实验论证。",
      bibPath: "references.bib",
      sectionMarkdownPattern: "section_materials/<section>/citations.md",
      literatureReviewPath: params.literatureReviewIncluded ? "literature_review.md" : undefined,
      citeKeys: [...params.bibEntryKeys],
    },
    exemplars: {
      description:
        "榜样论文集合。`section_materials/<section>/papers/` 与后续 `source_sections/` 只用于学习写作风格、结构和论证方式。",
      papersDirPattern: "section_materials/<section>/papers/",
      sourceSectionsPattern: "section_materials/<section>/papers/*/source_sections/",
    },
    boundaryNotes: [
      "同一篇论文允许同时出现在 references 与 exemplars，但两套集合在目录与语义上必须分开。",
      "正式引用默认先读取 references.bib，再读取当前 section 的 citations.md。",
      "写作风格与结构默认读取 papers/ 与 source_sections/，不依赖 references.bib 的目录结构。",
    ],
  };
}

export async function wakeMainSessionAfterResearchRun(params: {
  json?: boolean;
  send?: typeof callGatewayFromCli;
}): Promise<void> {
  const send = params.send ?? callGatewayFromCli;
  await send(
    "wake",
    { json: params.json === true },
    { mode: "now", text: RESEARCH_RUN_WAKE_TEXT },
    { expectFinal: false, progress: false },
  );
}

export async function wakeMainSessionAfterLongJob(params: {
  json?: boolean;
  send?: typeof callGatewayFromCli;
}): Promise<void> {
  const send = params.send ?? callGatewayFromCli;
  await send(
    "wake",
    { json: params.json === true },
    { mode: "now", text: LONG_JOB_WAKE_TEXT },
    { expectFinal: false, progress: false },
  );
}

export async function researchRunCommand(
  runtime: RuntimeEnv,
  opts: ResearchRunOptions = {},
): Promise<ResearchRunResult> {
  const idea = await readIdeaInput(opts);
  const count = resolveCount(opts.count);
  const model = resolveModel(opts.model);
  const thinking = resolveThinking(opts.thinking);
  const dryRun = opts.dryRun ?? false;
  const cwd = opts.cwd ?? process.cwd();
  const now = opts.now ?? new Date();
  const outputDir = opts.out ? path.resolve(cwd, opts.out) : defaultOutputRoot(cwd);
  const workspace = resolveResearchWorkspacePaths(outputDir);
  const {
    workspaceAgentsPath,
    statePath,
    ideaPath,
    specificationPath,
    layoutPath,
    literatureReviewPath,
    todoPath,
    referencesPath,
    dispatchLogPath,
    sessionNotesPath,
  } = workspace;
  const roleAgentPaths = [
    workspace.roleAgentPaths.step_planner,
    workspace.roleAgentPaths.coding_agent,
    workspace.roleAgentPaths.writing_agent,
  ];

  await initializeResearchWorkspace(workspace);
  await migrateLegacyResearchWorkspace(workspace);
  await Promise.all([
    fs.writeFile(workspaceAgentsPath, renderWorkspaceAgentsMarkdown(), "utf-8"),
    fs.writeFile(roleAgentPaths[0], renderRoleAgentsMarkdown("step_planner"), "utf-8"),
    fs.writeFile(roleAgentPaths[1], renderRoleAgentsMarkdown("coding_agent"), "utf-8"),
    fs.writeFile(roleAgentPaths[2], renderRoleAgentsMarkdown("writing_agent"), "utf-8"),
    fs.writeFile(dispatchLogPath, "# Dispatch Log\n", "utf-8"),
    fs.writeFile(sessionNotesPath, "# Session Notes\n", "utf-8"),
  ]);

  let report: ResearchReport;
  let ideaMarkdown: string;
  let specificationMarkdown: string;
  let referencesBib: string;
  let literatureReviewMarkdown: string | undefined;
  let todoMarkdown: string;
  let layoutMarkdown: string;
  let sectionCitationMarkdownBySlug = new Map<string, string>();
  let sectionExemplarsBySlug = new Map<string, ReadonlyArray<ResearchExemplarPaper>>();
  let writingStructureSections: ResearchWritingStructureSection[] = [];
  let writingStructureBySlug = new Map<string, ResearchWritingStructureSection>();

  if (dryRun) {
    const dryRunResult = buildDryRunResult({ idea, count, model, thinking, now });
    report = dryRunResult.report;
    ideaMarkdown = dryRunResult.ideaMarkdown;
    specificationMarkdown = dryRunResult.specificationMarkdown;
    referencesBib = dryRunResult.referencesBib;
    literatureReviewMarkdown = dryRunResult.literatureReviewMarkdown;
    todoMarkdown = dryRunResult.todoMarkdown;
    layoutMarkdown = dryRunResult.layoutMarkdown;
    writingStructureSections = dryRunResult.report.writingStructure;
    writingStructureBySlug = new Map(
      writingStructureSections.map((section) => [slugify(section.name), section] as const),
    );
    sectionCitationMarkdownBySlug = alignSectionCitationMarkdown({
      sections: report.sections,
      parsedSections: report.sectionCitations,
    });
    sectionExemplarsBySlug = alignSectionExemplars({
      sections: report.sections,
      parsedSections: report.sectionExemplars,
    });
  } else {
    const stageSummaries: ResearchReport["stages"] = [];
    const stageConfigs: ResearchReport["stageConfigs"] = [];
    const ideaPrompt = buildIdeaPrompt({ idea, count });
    const ideaResponse = await runStage(runtime, "idea", opts, {
      model,
      thinking,
      instructions: "Return valid JSON only. Do not wrap the answer in markdown fences.",
      input: ideaPrompt,
    });
    const ideaStage = parseStageOutput(IdeaStageSchema, ideaResponse.text);
    const normalizedSections: ResearchSection[] = ideaStage.sections.map((section, index) => ({
      id: section.id || `S${String(index + 1).padStart(2, "0")}`,
      name: slugify(section.name),
    }));
    ideaMarkdown = renderIdeaMarkdown({
      seedIdea: idea,
      refinedIdea: ideaStage.refinedIdea,
      sections: normalizedSections,
    });
    stageSummaries.push({
      name: "idea",
      summary: "Refined the seed idea and designed paper sections.",
      responseId: ideaResponse.id,
    });
    stageConfigs.push({
      name: "idea",
      prompt: ideaPrompt,
      enabledTools: ideaResponse.attachedTools,
      artifactTargets: ["idea.md"],
      responseId: ideaResponse.id,
      skippedTools: ideaResponse.skippedTools,
    });
    await fs.writeFile(ideaPath, ideaMarkdown, "utf-8");

    const writingStructureStageResult = await runStageWithContextFallback(
      runtime,
      "writing_structure",
      opts,
      {
        model,
        thinking,
        previousResponseId: ideaResponse.id,
        instructions: "Return valid JSON only. Do not wrap the answer in markdown fences.",
        primaryInput: buildWritingStructurePrompt(),
        fallbackInput: buildWritingStructurePromptWithContext({
          seedIdea: idea,
          refinedIdea: ideaStage.refinedIdea,
          sections: normalizedSections,
        }),
      },
    );
    const writingStructureResponse = writingStructureStageResult.response;
    const writingStructureStage = parseStageOutput(
      WritingStructureStageSchema,
      writingStructureResponse.text,
    );
    writingStructureSections = alignWritingStructureSections({
      sections: normalizedSections,
      writingStructure: writingStructureStage.sections,
    });
    writingStructureBySlug = new Map(
      writingStructureSections.map((section) => [slugify(section.name), section] as const),
    );
    layoutMarkdown = renderLayoutMarkdown(writingStructureSections);
    stageSummaries.push({
      name: "writing_structure",
      summary: "Expanded the section list into section-level writing briefs.",
      responseId: writingStructureResponse.id,
    });
    stageConfigs.push({
      name: "writing_structure",
      prompt: writingStructureStageResult.prompt,
      enabledTools: writingStructureResponse.attachedTools,
      artifactTargets: ["layout.md", "section_materials/<section>/brief.md"],
      responseId: writingStructureResponse.id,
      skippedTools: writingStructureResponse.skippedTools,
    });
    await fs.writeFile(layoutPath, layoutMarkdown, "utf-8");
    await initializeSectionArtifacts({
      paths: workspace,
      sections: normalizedSections,
      writingStructureBySection: writingStructureBySlug,
      citationsBySection: sectionCitationMarkdownBySlug,
      exemplarsBySection: sectionExemplarsBySlug,
    });

    const specificationStageResult = await runStageWithContextFallback(
      runtime,
      "specification",
      opts,
      {
        model,
        thinking,
        previousResponseId: ideaResponse.id,
        instructions: "Return markdown only. Do not wrap the answer in markdown fences.",
        primaryInput: buildSpecificationPrompt(),
        fallbackInput: buildSpecificationPromptWithContext({
          seedIdea: idea,
          refinedIdea: ideaStage.refinedIdea,
          sections: normalizedSections,
        }),
      },
    );
    const specificationResponse = specificationStageResult.response;
    const specificationStage = parseSpecificationMarkdown(specificationResponse.text);
    specificationMarkdown = specificationStage.markdown;
    stageSummaries.push({
      name: "specification",
      summary: "Wrote the research specification from the refined idea.",
      responseId: specificationResponse.id,
    });
    stageConfigs.push({
      name: "specification",
      prompt: specificationStageResult.prompt,
      enabledTools: specificationResponse.attachedTools,
      artifactTargets: ["specification.md"],
      responseId: specificationResponse.id,
      skippedTools: specificationResponse.skippedTools,
    });
    await fs.writeFile(specificationPath, specificationMarkdown, "utf-8");

    const paperStageResult = await runStageWithContextFallback(runtime, "paper", opts, {
      model,
      thinking,
      previousResponseId: writingStructureResponse.id,
      instructions: "Return valid JSON only. Do not wrap the answer in markdown fences.",
      primaryInput: buildPaperPrompt(),
      fallbackInput: buildPaperPromptWithContext({
        ideaMarkdown,
        layoutMarkdown,
      }),
      allowedTools: ["web_search"],
    });
    const paperResponse = paperStageResult.response;
    const paperStage = parsePaperTextOutput(paperResponse.text);
    sectionCitationMarkdownBySlug = alignSectionCitationMarkdown({
      sections: normalizedSections,
      parsedSections: paperStage.sectionCitations,
    });
    sectionExemplarsBySlug = alignSectionExemplars({
      sections: normalizedSections,
      parsedSections: paperStage.sectionExemplars,
    });
    referencesBib = paperStage.bib;
    literatureReviewMarkdown = renderLiteratureReviewMarkdown(paperStage.literatureReviewMarkdown);
    stageSummaries.push({
      name: "paper",
      summary: "Collected references and produced per-section literature notes.",
      responseId: paperResponse.id,
    });
    stageConfigs.push({
      name: "paper",
      prompt: paperStageResult.prompt,
      enabledTools: paperResponse.attachedTools,
      artifactTargets: [
        "references.bib",
        "literature_review.md",
        "section_materials/<section>/citations.md",
      ],
      responseId: paperResponse.id,
      skippedTools: paperResponse.skippedTools,
    });
    await Promise.all([
      fs.writeFile(referencesPath, referencesBib, "utf-8"),
      literatureReviewMarkdown
        ? fs.writeFile(literatureReviewPath, literatureReviewMarkdown, "utf-8")
        : fs.rm(literatureReviewPath, { force: true }),
    ]);
    await initializeSectionArtifacts({
      paths: workspace,
      sections: normalizedSections,
      writingStructureBySection: writingStructureBySlug,
      citationsBySection: sectionCitationMarkdownBySlug,
      exemplarsBySection: sectionExemplarsBySlug,
    });

    const todoStageResult = await runStageWithContextFallback(runtime, "todo", opts, {
      model,
      thinking,
      previousResponseId: specificationResponse.id,
      instructions: "Return valid JSON only. Do not wrap the answer in markdown fences.",
      primaryInput: buildTodoPrompt(),
      fallbackInput: buildTodoPromptWithContext({
        ideaMarkdown,
        specificationMarkdown,
      }),
    });
    const todoResponse = todoStageResult.response;
    const todoStage = parseStageOutput(TodoStageSchema, todoResponse.text);
    stageConfigs.push({
      name: "todo",
      prompt: todoStageResult.prompt,
      enabledTools: todoResponse.attachedTools,
      artifactTargets: ["todo.md", "tasks/Txx/plan.md"],
      responseId: todoResponse.id,
      skippedTools: todoResponse.skippedTools,
    });
    stageSummaries.push({
      name: "todo",
      summary: "Generated the execution-ready todo list.",
      responseId: todoResponse.id,
    });
    todoMarkdown = renderTopLevelTodoMarkdown(todoStage.todo);
    await fs.writeFile(todoPath, todoMarkdown, "utf-8");

    report = {
      idea,
      refinedIdea: ideaStage.refinedIdea,
      model,
      apiModel: model.replace(/^openai\//, ""),
      thinking,
      dryRun: false,
      createdAt: now.toISOString(),
      stages: stageSummaries,
      availableTools: paperResponse.attachedTools,
      skippedTools: paperResponse.skippedTools,
      stageConfigs,
      sections: normalizedSections,
      writingStructure: writingStructureSections,
      referencesBib,
      literatureReviewMarkdown,
      sectionCitations: paperStage.sectionCitations,
      sectionExemplars: [...sectionExemplarsBySlug.entries()].map(([section, papers]) => ({
        section,
        papers: [...papers],
      })),
      artifactCollections: buildArtifactCollections({
        bibEntryKeys: paperStage.bibEntryKeys,
        literatureReviewIncluded: Boolean(literatureReviewMarkdown),
      }),
      specification: specificationStage.specification,
      todo: todoStage.todo,
    };
  }

  const layoutSections = parseLayoutMarkdown(layoutMarkdown);
  const taskPlanPaths = await Promise.all(
    report.todo.map(async (item: ResearchTodoItem) => {
      const taskDir = path.join(outputDir, item.subtasksDir);
      const artifactPaths = await initializeTaskArtifactScaffold(outputDir, item.subtasksDir);
      const taskPlanPath = artifactPaths.planPath;
      await fs.writeFile(taskPlanPath, renderTaskPlanMarkdown(item, layoutSections), "utf-8");
      return taskPlanPath;
    }),
  );

  const manuscriptValidation = await validateManuscriptTemplate({ paths: workspace, dryRun });
  if (manuscriptValidation.warning) {
    runtime.log(manuscriptValidation.warning);
  }

  await Promise.all([
    fs.writeFile(ideaPath, ideaMarkdown, "utf-8"),
    fs.writeFile(specificationPath, specificationMarkdown, "utf-8"),
    fs.writeFile(layoutPath, layoutMarkdown, "utf-8"),
    fs.writeFile(todoPath, todoMarkdown || renderTopLevelTodoMarkdown(report.todo), "utf-8"),
    fs.writeFile(referencesPath, referencesBib || report.referencesBib, "utf-8"),
    literatureReviewMarkdown
      ? fs.writeFile(literatureReviewPath, literatureReviewMarkdown, "utf-8")
      : fs.rm(literatureReviewPath, { force: true }),
  ]);
  await initializeSectionArtifacts({
    paths: workspace,
    sections: report.sections,
    writingStructureBySection:
      writingStructureBySlug.size > 0
        ? writingStructureBySlug
        : new Map(report.writingStructure.map((section) => [slugify(section.name), section] as const)),
    citationsBySection: sectionCitationMarkdownBySlug,
    exemplarsBySection: sectionExemplarsBySlug,
  });
  if (!dryRun) {
    await materializeExemplarPapers({
      paths: workspace,
      exemplarsBySection: sectionExemplarsBySlug,
      fetchImpl: opts.fetchImpl,
    });
    await initializeSectionArtifacts({
      paths: workspace,
      sections: report.sections,
      writingStructureBySection:
        writingStructureBySlug.size > 0
          ? writingStructureBySlug
          : new Map(
              report.writingStructure.map((section) => [slugify(section.name), section] as const),
            ),
      citationsBySection: sectionCitationMarkdownBySlug,
      exemplarsBySection: sectionExemplarsBySlug,
    });
  }

  const result: ResearchRunResult = {
    outputDir,
    workspaceAgentsPath,
    statePath,
    ideaPath,
    specificationPath,
    layoutPath,
    literatureReviewPath,
    todoPath,
    referencesPath,
    taskDirs: report.todo.map((item) => path.join(outputDir, item.subtasksDir)),
    taskPlanPaths,
    roleAgentPaths,
    dryRun,
    report,
  };

  if (!dryRun) {
    await (opts.wakeMainSession ?? wakeMainSessionAfterResearchRun)({
      json: opts.json === true,
    });
  }

  runtime.log(opts.json ? JSON.stringify(result, null, 2) : formatResultSummary(result));
  return result;
}

export async function researchTickCommand(
  runtime: RuntimeEnv,
  opts: ResearchTickOptions = {},
): Promise<ResearchTickResult> {
  const cwd = opts.cwd ?? process.cwd();
  const workspaceDir = opts.workspace
    ? path.resolve(cwd, opts.workspace)
    : defaultTickWorkspace(cwd);
  const now = opts.now ?? new Date();
  const todoPath = path.join(workspaceDir, "todo.md");
  const statePath = path.join(workspaceDir, "state.json");
  const layoutPath = path.join(workspaceDir, "layout.md");
  const roleRunner = opts.roleRunner ?? defaultRoleRunner;
  const launchLongJob = opts.launchLongJob ?? launchPreparedLongResearchJob;
  const startLongJobSupervisor =
    opts.startLongJobSupervisor ?? startDetachedLongResearchJobSupervisor;

  let state = await readWorkspaceState(statePath);
  let dispatch = await resolveWorkspaceDispatch({
    workspaceDir,
    todoPath,
    layoutPath,
    state,
  });
  if (dispatch.taskSnapshots.length === 0) {
    throw new Error(`No tasks found in ${todoPath}`);
  }

  for (const snapshot of dispatch.taskSnapshots) {
    if (!snapshot.hasPlan) {
      continue;
    }
    const normalizedStatus = resolveParsedTaskStatus(snapshot.task);
    if (snapshot.task.status !== normalizedStatus) {
      snapshot.task.status = normalizedStatus;
      await writeTaskPlanIfChanged(snapshot.task);
    }
  }

  if (dispatch.completed) {
    state = {
      ...state,
      activeTaskId: undefined,
      forceReplanTaskId: undefined,
      lastAction: "completed",
      updatedAt: now.toISOString(),
    };
    await Promise.all([
      fs.writeFile(todoPath, renderTopLevelTodoMarkdown(dispatch.todoItems), "utf-8"),
      writeWorkspaceState(statePath, state),
    ]);
    const result: ResearchTickResult = {
      workspaceDir,
      statePath,
      todoPath,
      action: "completed",
      summary: "当前顶层任务已经全部完成。",
    };
    runtime.log(opts.json ? JSON.stringify(result, null, 2) : formatTickSummary(result));
    return result;
  }

  const activeTask = dispatch.activeTask?.task;
  if (!activeTask) {
    throw new Error("Failed to resolve an active task.");
  }
  const existingLongJob = await tryReadResearchLongJob(
    resolveTaskArtifactPaths(workspaceDir, activeTask.dir).jobPath,
  );
  if (existingLongJob && (isPreparedLongJob(existingLongJob) || isActiveLongJob(existingLongJob))) {
    const shouldStartSupervisor = isPreparedLongJob(existingLongJob);
    const longJobPath = shouldStartSupervisor
      ? await launchLongJob({
          workspaceDir,
          taskId: activeTask.id,
          json: opts.json,
          now,
        })
      : resolveTaskArtifactPaths(workspaceDir, activeTask.dir).jobPath;
    if (shouldStartSupervisor) {
      await startLongJobSupervisor({
        workspaceDir,
        taskId: activeTask.id,
        json: opts.json,
      });
    }
    state = {
      ...state,
      activeTaskId: activeTask.id,
      lastAction: "awaiting_long_job_supervisor",
      lastRole: undefined,
      lastTaskId: activeTask.id,
      updatedAt: now.toISOString(),
    };
    await writeWorkspaceState(statePath, state);
    const result: ResearchTickResult = {
      workspaceDir,
      statePath,
      todoPath,
      activeTaskId: activeTask.id,
      action: "awaiting_long_job_supervisor",
      longJobPath: path.relative(workspaceDir, longJobPath).replace(/\\/g, "/"),
      summary: `${activeTask.id} 的长任务已交给后台 supervisor，主会话本轮不再阻塞等待。`,
    };
    runtime.log(opts.json ? JSON.stringify(result, null, 2) : formatTickSummary(result));
    return result;
  }

  const role = dispatch.role;
  if (!role) {
    throw new Error("Failed to resolve a dispatch role from workspace state.");
  }
  if (dispatch.activeTask?.hasPlan && activeTask.status === "pending") {
    activeTask.status = role === "step_planner" ? "pending" : "in_progress";
    await writeTaskPlanIfChanged(activeTask);
  }
  const taskArtifactPaths = resolveTaskArtifactPaths(workspaceDir, activeTask.dir);
  const nextWritingItem =
    role === "writing_agent"
      ? activeTask.sectionQueue.find((entry) => entry.status !== "done")
      : undefined;
  const [planBeforeRun, summaryBeforeRun, resultBeforeRun, runLogBeforeRun, manuscriptBeforeRun] =
    await Promise.all([
      readFileOrEmpty(activeTask.path),
      role === "coding_agent"
        ? readFileOrEmpty(taskArtifactPaths.summaryPath)
        : Promise.resolve(""),
      role === "coding_agent"
        ? readFileOrEmpty(taskArtifactPaths.resultJsonPath)
        : Promise.resolve(""),
      role === "coding_agent" ? readFileOrEmpty(taskArtifactPaths.runLogPath) : Promise.resolve(""),
      role === "writing_agent" && nextWritingItem
        ? readFileOrEmpty(path.join(workspaceDir, nextWritingItem.manuscriptPath))
        : Promise.resolve(""),
    ]);
  const shouldArchivePlanBeforeReplan =
    role === "step_planner" &&
    dispatch.activeTask?.hasPlan === true &&
    (state.forceReplanTaskId === activeTask.id ||
      activeTask.blockers.some((entry) => {
        const normalized = entry.trim();
        return normalized.length > 0 && normalized !== "暂无";
      }));
  if (shouldArchivePlanBeforeReplan) {
    await archiveTaskPlanSnapshot({ task: activeTask, now });
  }
  if (role === "writing_agent" && nextWritingItem) {
    await writeWritingSectionTaskPackage({
      workspaceDir,
      task: activeTask,
      queueItem: nextWritingItem,
    });
  }

  const roleResult = await roleRunner({
    role,
    workspaceDir,
    taskId: activeTask.id,
    prompt: buildTaskPrompt({
      role,
      task: activeTask,
      workspaceDir,
      agentWorkspaceDir: resolveRoleWorkspaceDir(workspaceDir, role),
    }),
    env: opts.env ?? process.env,
  });

  let refreshedTask = activeTask;
  let refreshedContent = planBeforeRun;
  try {
    refreshedContent = await fs.readFile(refreshedTask.path, "utf-8");
    refreshedTask = parseTaskPlanMarkdown({
      content: refreshedContent,
      taskDir: refreshedTask.dir,
      taskPath: refreshedTask.path,
      layoutContent: await fs.readFile(layoutPath, "utf-8"),
    });
  } catch {
    refreshedTask = activeTask;
  }

  if (role === "coding_agent") {
    await validateCodingTaskArtifacts({
      workspaceDir,
      taskDir: activeTask.dir,
      planBeforeRun,
      summaryBeforeRun,
      resultBeforeRun,
      runLogBeforeRun,
    });
    const preparedLongJob = await validatePreparedLongJobArtifacts({
      workspaceDir,
      taskDir: activeTask.dir,
    });
    if (roleResult.needs_long_job && !preparedLongJob) {
      throw new Error(
        `coding_agent requested a long job for ${activeTask.dir} but did not write launch.sh/job.json.`,
      );
    }
  }
  if (role === "writing_agent") {
    if (!nextWritingItem) {
      throw new Error(`${activeTask.id} has no executable writing queue item.`);
    }
    await validateWritingTaskArtifacts({
      workspaceDir,
      taskDir: activeTask.dir,
      planBeforeRun,
      manuscriptPath: nextWritingItem.manuscriptPath,
      manuscriptBeforeRun,
    });
  }

  if (
    roleResult.needs_replan ||
    roleResult.status === "blocked" ||
    refreshedTask.blockers.some((entry) => entry.trim().length > 0 && entry.trim() !== "暂无")
  ) {
    state.forceReplanTaskId = refreshedTask.id;
  } else if (role === "step_planner") {
    state.forceReplanTaskId = undefined;
  }

  const refreshedStatus = resolveParsedTaskStatus(refreshedTask);
  const allPlanItemsDone =
    refreshedTask.workerType === "writing"
      ? refreshedTask.sectionQueue.length > 0 &&
        refreshedTask.sectionQueue.every((entry) => entry.status === "done")
      : refreshedTask.steps.length > 0 &&
        refreshedTask.steps.every((entry) => entry.status === "done");
  refreshedTask.status = allPlanItemsDone
    ? "done"
    : state.forceReplanTaskId === refreshedTask.id
      ? "in_progress"
      : refreshedStatus === "pending" && role !== "step_planner"
        ? "in_progress"
        : refreshedStatus;
  await writeTaskPlanIfChanged(refreshedTask);

  dispatch = await resolveWorkspaceDispatch({
    workspaceDir,
    todoPath,
    layoutPath,
    state,
  });
  const nextActiveTask = dispatch.activeTask?.task;
  state = {
    ...state,
    activeTaskId: nextActiveTask?.id,
    lastAction: `dispatched:${role}`,
    lastRole: role,
    lastTaskId: refreshedTask.id,
    updatedAt: now.toISOString(),
  };

  await Promise.all([
    fs.writeFile(todoPath, renderTopLevelTodoMarkdown(dispatch.todoItems), "utf-8"),
    writeWorkspaceState(statePath, state),
  ]);

  const result: ResearchTickResult = {
    workspaceDir,
    statePath,
    todoPath,
    activeTaskId: nextActiveTask?.id,
    action:
      role === "step_planner"
        ? "dispatched_step_planner"
        : role === "writing_agent"
          ? "dispatched_writing_agent"
          : "dispatched_coding_agent",
    dispatchedRole: role,
    roleResult,
    summary: roleResult.summary,
  };
  runtime.log(opts.json ? JSON.stringify(result, null, 2) : formatTickSummary(result));
  return result;
}

export async function researchSuperviseJobCliCommand(
  runtime: RuntimeEnv,
  opts: ResearchSuperviseJobOptions,
) {
  return await researchSuperviseJobCommand(runtime, {
    ...opts,
    wakeMainSession: opts.wakeMainSession ?? wakeMainSessionAfterLongJob,
  });
}
