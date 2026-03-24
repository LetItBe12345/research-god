import { z } from "zod";
import {
  RESEARCH_API_MODELS,
  RESEARCH_RESPONSE_MODES as RESEARCH_OPENAI_RESPONSE_MODES,
  RESEARCH_THINKING_LEVELS,
  type ResearchApiModel as ResearchOpenAiModel,
  type ResearchAvailableTool,
  type ResearchResponseMode as ResearchOpenAiResponseMode,
  type ResearchThinkingLevel as ResearchOpenAiThinkingLevel,
} from "../commands/research.openai.js";
import type { RuntimeEnv } from "../runtime.js";

export const RESEARCH_STAGE_NAMES = [
  "idea",
  "writing_structure",
  "specification",
  "paper",
  "todo",
] as const;
export const RESEARCH_MODELS = RESEARCH_API_MODELS;
export const RESEARCH_RESPONSE_MODES = RESEARCH_OPENAI_RESPONSE_MODES;
export { RESEARCH_THINKING_LEVELS };
export const RESEARCH_LAYOUT_FILENAME = "layout.md";
export const RESEARCH_LAYOUT_ALIASES = ["落盘.md"] as const;
export const RESEARCH_SHORT_TASK_MAX_MINUTES = 15;

export type ResearchStageName = (typeof RESEARCH_STAGE_NAMES)[number];
export type ResearchModel = ResearchOpenAiModel;
export type ResearchResponseMode = ResearchOpenAiResponseMode;
export type ResearchThinkingLevel = ResearchOpenAiThinkingLevel;
export const RESEARCH_ROLE_NAMES = ["step_planner", "coding_agent", "writing_agent"] as const;
export type ResearchRoleName = (typeof RESEARCH_ROLE_NAMES)[number];
export type ResearchWorkspacePaths = {
  outputDir: string;
  workspaceAgentsPath: string;
  ideaPath: string;
  specificationPath: string;
  layoutPath: string;
  literatureReviewPath: string;
  referencesPath: string;
  todoPath: string;
  tasksDir: string;
  agentsDir: string;
  sectionMaterialsDir: string;
  runtimeDir: string;
  dispatchLogPath: string;
  sessionNotesPath: string;
  manuscriptDir: string;
  manuscriptMainPath: string;
  manuscriptSectionsDir: string;
  statePath: string;
  roleAgentPaths: Record<ResearchRoleName, string>;
};

export type ResearchRunOptions = {
  idea?: string;
  ideaFile?: string;
  count?: number;
  model?: string;
  thinking?: string;
  requestTimeoutMs?: number;
  responseMode?: string;
  pollIntervalMs?: number;
  out?: string;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  now?: Date;
  env?: NodeJS.ProcessEnv;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  wakeMainSession?: (params: { json?: boolean }) => Promise<void>;
};

export type ResearchTickOptions = {
  workspace?: string;
  json?: boolean;
  cwd?: string;
  now?: Date;
  env?: NodeJS.ProcessEnv;
  roleRunner?: (params: {
    role: ResearchRoleName;
    workspaceDir: string;
    taskId: string;
    prompt: string;
    env?: NodeJS.ProcessEnv;
  }) => Promise<ResearchRoleResult>;
  launchLongJob?: (params: {
    workspaceDir: string;
    taskId: string;
    json?: boolean;
    now?: Date;
  }) => Promise<string>;
  startLongJobSupervisor?: (params: {
    workspaceDir: string;
    taskId: string;
    json?: boolean;
  }) => Promise<void>;
};

export type ResearchSuperviseJobOptions = {
  workspace?: string;
  taskId: string;
  json?: boolean;
  cwd?: string;
  now?: Date;
  wakeMainSession?: (params: { json?: boolean }) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

export type ResearchSection = {
  id: string;
  name: string;
};

export const RESEARCH_WRITING_CONTEXT_READS = [
  "references_bib",
  "literature_review",
  "experiment_results",
  "existing_tex",
] as const;
export type ResearchWritingContextRead = (typeof RESEARCH_WRITING_CONTEXT_READS)[number];

export type ResearchWritingStructureSection = {
  id: string;
  name: string;
  writingGoal: string;
  keyPoints: string[];
  questionsToAnswer: string[];
  avoidPatterns: string[];
  requiredContext: ResearchWritingContextRead[];
};

export type ResearchLayoutSection = {
  id: string;
  slug: string;
  materialsDir: string;
  citationsFile: string;
  briefFile: string;
  manuscriptTex: string;
};

export type ResearchCitationEntry = {
  title: string;
  citationKey: string;
  summary: string;
};

export type ResearchSectionCitations = {
  section: string;
  entries: ResearchCitationEntry[];
};

export type ResearchExemplarPaper = {
  citationKey: string;
  title: string;
  pdfUrl: string;
  shortIntro: string;
  whyRelevant: string;
};

export type ResearchSourceSectionReference = {
  paperId: string;
  citationKey: string;
  sectionTitle: string;
  sectionSlug: string;
  relativePath: string;
  selectionReason: string;
};

export type ResearchSectionBrief = {
  sectionId: string;
  sectionTitle: string;
  writingGoal: string;
  keyPoints: string[];
  questionsToAnswer: string[];
  avoidPatterns: string[];
  latexOutputPath: string;
  sourceSections: ResearchSourceSectionReference[];
  referencesBibPath?: string;
  literatureReviewPath?: string;
  experimentResultPaths: string[];
  existingTexPaths: string[];
};

export type ParsedResearchSectionBrief = {
  sectionId?: string;
  sectionTitle?: string;
  writingGoal?: string;
  latexOutputPath?: string;
  sourceSectionPaths: string[];
  sourceSectionCitationKeys: string[];
  referencesBibPath?: string;
  literatureReviewPath?: string;
  experimentResultPaths: string[];
  existingTexPaths: string[];
};

export type ResearchSectionExemplars = {
  section: string;
  papers: ResearchExemplarPaper[];
};

export type ResearchArtifactCollections = {
  references: {
    description: string;
    bibPath: string;
    sectionMarkdownPattern: string;
    literatureReviewPath?: string;
    citeKeys: string[];
  };
  exemplars: {
    description: string;
    papersDirPattern: string;
    sourceSectionsPattern: string;
  };
  boundaryNotes: string[];
};

export type ResearchTaskWorkerType = "coding" | "writing";

export type ResearchTodoItem = {
  id: string;
  title: string;
  workerType: ResearchTaskWorkerType;
  objective: string;
  acceptance: string[];
  status: "done" | "in_progress" | "pending";
  subtasksDir: string;
};

export type ResearchStageConfig = {
  name: ResearchStageName;
  prompt: string;
  enabledTools: ResearchAvailableTool[];
  artifactTargets: string[];
  responseId?: string;
  skippedTools?: Array<{ tool: ResearchAvailableTool; reason: string }>;
};

export type ResearchSpecification = {
  problem: string;
  scope: string;
  method: string[];
  evaluation: string[];
  risks: string[];
  resources: {
    backbone: {
      name: string;
      url: string;
      notes: string;
    };
    datasets: Array<{
      name: string;
      url: string;
      notes: string;
    }>;
    baselines: Array<{
      name: string;
      url: string;
      notes: string;
    }>;
  };
  execution: {
    environment: string[];
    entrypoints: Array<{
      path: string;
      purpose: string;
    }>;
    commands: {
      prepare: string[];
      train: string[];
      evaluate: string[];
    };
    expectedArtifacts: string[];
  };
};

export type ResearchReport = {
  idea: string;
  refinedIdea: string;
  model: string;
  apiModel: string;
  thinking: string;
  dryRun: boolean;
  createdAt: string;
  stages: Array<{
    name: ResearchStageName;
    summary: string;
    responseId?: string;
  }>;
  availableTools: ResearchAvailableTool[];
  skippedTools: Array<{ tool: ResearchAvailableTool; reason: string }>;
  stageConfigs: ResearchStageConfig[];
  sections: ResearchSection[];
  writingStructure: ResearchWritingStructureSection[];
  referencesBib: string;
  literatureReviewMarkdown?: string;
  sectionCitations: ResearchSectionCitations[];
  sectionExemplars: ResearchSectionExemplars[];
  artifactCollections: ResearchArtifactCollections;
  specification: ResearchSpecification;
  todo: ResearchTodoItem[];
};

export type ResearchRunResult = {
  outputDir: string;
  workspaceAgentsPath: string;
  statePath: string;
  ideaPath: string;
  specificationPath: string;
  layoutPath: string;
  literatureReviewPath: string;
  todoPath: string;
  referencesPath: string;
  taskDirs: string[];
  taskPlanPaths: string[];
  roleAgentPaths: string[];
  dryRun: boolean;
  report: ResearchReport;
};

export type ResearchRoleResult = {
  status: "done" | "blocked" | "failed";
  summary: string;
  updated_files: string[];
  needs_replan: boolean;
  needs_long_job: boolean;
  long_job_request: string;
  artifacts: string[];
  rawStdout: string;
  rawStderr: string;
  exitCode: number | null;
  stdoutBrief?: {
    result: "done" | "blocked" | "failed";
    summary: string;
    planUpdate: string;
    nextHint: string;
  };
};

export type ResearchTickResult = {
  workspaceDir: string;
  statePath: string;
  todoPath: string;
  activeTaskId?: string;
  action:
    | "dispatched_step_planner"
    | "dispatched_coding_agent"
    | "dispatched_writing_agent"
    | "awaiting_long_job_supervisor"
    | "completed";
  dispatchedRole?: ResearchRoleName;
  roleResult?: ResearchRoleResult;
  longJobPath?: string;
  summary: string;
};

export type ResearchPlanItemStatus = "done" | "in_progress" | "pending";

export type ResearchTaskPlanStep = {
  id: string;
  status: ResearchPlanItemStatus;
  task: string;
  acceptance: string;
};

export type ResearchTaskPlanSectionQueueItem = {
  id: string;
  status: ResearchPlanItemStatus;
  sectionId: string;
  sectionSlug: string;
  materialsDir: string;
  manuscriptPath: string;
  acceptance: string;
};

export type ResearchWritingSectionTaskPackage = {
  taskId: string;
  queueItemId: string;
  sectionId: string;
  sectionSlug: string;
  briefPath: string;
  sourceSectionPaths: string[];
  outputTexPath: string;
  planPath: string;
  resultJsonPaths: string[];
  summaryPaths: string[];
  citationKeys: string[];
  referencesBibPath?: string;
  citationsPath?: string;
  literatureReviewPath?: string;
  existingTexPaths: string[];
};

export type ParsedTaskPlan = {
  id: string;
  title: string;
  workerType: ResearchTaskWorkerType;
  status: ResearchPlanItemStatus;
  objective: string;
  acceptance: string[];
  steps: ResearchTaskPlanStep[];
  sectionQueue: ResearchTaskPlanSectionQueueItem[];
  blockers: string[];
  lastRunResult: string;
  nextActionHint: string;
  dir: string;
  path: string;
};

export type ResearchWorkspaceState = {
  version: 1;
  activeTaskId?: string;
  forceReplanTaskId?: string;
  lastAction?: string;
  lastRole?: ResearchRoleName;
  lastTaskId?: string;
  updatedAt: string;
};

export type ResearchLongJobStatus =
  | "prepared"
  | "launching"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked";

export type ResearchLongJob = {
  version: 1;
  taskId: string;
  jobId: string;
  status: ResearchLongJobStatus;
  createdAt: string;
  updatedAt: string;
  launchPath: string;
  outputDir: string;
  logPath: string;
  summary: string;
  command?: string;
  serviceName?: string;
  pid?: number;
  monitorPath?: string;
  startedAt?: string;
  finishedAt?: string;
  wakeOnComplete?: boolean;
  outputPaths?: string[];
  lastError?: string;
};

export type ResearchCommandRuntime = Pick<RuntimeEnv, "log" | "error" | "exit">;

export const IdeaStageSchema = z.object({
  refinedIdea: z.string().min(1),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
      }),
    )
    .min(1),
});

export const WritingStructureStageSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        writingGoal: z.string().min(1),
        keyPoints: z.array(z.string().min(1)).min(1),
        questionsToAnswer: z.array(z.string().min(1)).min(1),
        avoidPatterns: z.array(z.string().min(1)).min(1),
        requiredContext: z.array(z.enum(RESEARCH_WRITING_CONTEXT_READS)).default([]),
      }),
    )
    .min(1),
});

export const TodoStageSchema = z.object({
  todo: z
    .array(
      z.object({
        id: z.string().regex(/^T\d+$/),
        title: z.string().min(1),
        workerType: z.enum(["coding", "writing"]),
        objective: z.string().min(1),
        acceptance: z.array(z.string().min(1)).min(1),
        status: z.enum(["done", "in_progress", "pending"]),
        subtasksDir: z.string().min(1),
      }),
    )
    .min(6)
    .max(10),
});

export const RoleResultSchema = z.object({
  status: z.enum(["done", "blocked", "failed"]),
  summary: z.string().min(1),
  updated_files: z.array(z.string()),
  needs_replan: z.boolean(),
  needs_long_job: z.boolean(),
  long_job_request: z.string(),
  artifacts: z.array(z.string()),
});

export const ResearchLongJobSchema = z.object({
  version: z.literal(1),
  taskId: z.string().regex(/^T\d+$/),
  jobId: z.string().min(1),
  status: z.enum(["prepared", "launching", "running", "succeeded", "failed", "blocked"]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  launchPath: z.string().min(1),
  outputDir: z.string().min(1),
  logPath: z.string().min(1),
  summary: z.string().min(1),
  command: z.string().optional(),
  serviceName: z.string().optional(),
  pid: z.number().int().positive().optional(),
  monitorPath: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  wakeOnComplete: z.boolean().optional(),
  outputPaths: z.array(z.string().min(1)).optional(),
  lastError: z.string().optional(),
});
