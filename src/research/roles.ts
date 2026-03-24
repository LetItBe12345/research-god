import fs from "node:fs/promises";
import path from "node:path";
import { runCliAgent } from "../agents/cli-runner.js";
import { parseTaskPlanMarkdown, parseWorkerStdoutBrief } from "./parsing.js";
import { buildTaskPrompt } from "./prompts.js";
import { renderParsedTaskPlanMarkdown } from "./render.js";
import { normalizeWhitespace } from "./shared.js";
import {
  type ParsedTaskPlan,
  type ResearchRoleName,
  type ResearchRoleResult,
  type ResearchWorkspaceState,
} from "./types.js";
import { resolveRoleWorkspaceDir } from "./workspace.js";

function hasMeaningfulEntries(entries: string[]): boolean {
  return entries.some((entry) => {
    const normalized = normalizeWhitespace(entry);
    return normalized.length > 0 && normalized !== "暂无";
  });
}

function getPendingPlanItems(task: ParsedTaskPlan) {
  return task.workerType === "writing"
    ? task.sectionQueue.filter((entry) => entry.status !== "done")
    : task.steps.filter((entry) => entry.status !== "done");
}

function hasActionablePlanItems(task: ParsedTaskPlan): boolean {
  return getPendingPlanItems(task).some((entry) => {
    if ("task" in entry) {
      return normalizeWhitespace(entry.task).length > 0;
    }
    return normalizeWhitespace(entry.sectionSlug).length > 0;
  });
}

function areAllPlanItemsDone(task: ParsedTaskPlan): boolean {
  const items = task.workerType === "writing" ? task.sectionQueue : task.steps;
  return items.length > 0 && items.every((entry) => entry.status === "done");
}

export function resolveParsedTaskStatus(task: ParsedTaskPlan): ParsedTaskPlan["status"] {
  if (areAllPlanItemsDone(task)) {
    return "done";
  }
  if (!hasActionablePlanItems(task)) {
    return "pending";
  }
  return task.status === "done" ? "in_progress" : task.status;
}

export function toResearchTodoItem(task: ParsedTaskPlan) {
  return {
    id: task.id,
    title: task.title,
    workerType: task.workerType,
    objective: task.objective,
    acceptance: task.acceptance,
    status: task.status,
    subtasksDir: `${task.dir}/`,
  };
}

export async function readWorkspaceState(statePath: string): Promise<ResearchWorkspaceState> {
  try {
    const content = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(content) as Partial<ResearchWorkspaceState>;
    return {
      version: 1,
      activeTaskId: typeof parsed.activeTaskId === "string" ? parsed.activeTaskId : undefined,
      forceReplanTaskId:
        typeof parsed.forceReplanTaskId === "string" ? parsed.forceReplanTaskId : undefined,
      lastAction: typeof parsed.lastAction === "string" ? parsed.lastAction : undefined,
      lastRole: typeof parsed.lastRole === "string" ? parsed.lastRole : undefined,
      lastTaskId: typeof parsed.lastTaskId === "string" ? parsed.lastTaskId : undefined,
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.trim().length > 0
          ? parsed.updatedAt
          : new Date(0).toISOString(),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
    };
  }
}

export async function writeWorkspaceState(
  statePath: string,
  state: ResearchWorkspaceState,
): Promise<void> {
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

export async function readTaskPlans(
  tasksDir: string,
  layoutPath: string,
): Promise<ParsedTaskPlan[]> {
  const entries = await fs.readdir(tasksDir, { withFileTypes: true });
  const layoutContent = await fs.readFile(layoutPath, "utf-8");
  const taskDirs = entries
    .filter((entry) => entry.isDirectory() && /^T\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .toSorted();
  return await Promise.all(
    taskDirs.map(async (taskId) => {
      const taskDir = path.posix.join("tasks", taskId);
      const taskPath = path.join(tasksDir, taskId, "plan.md");
      const content = await fs.readFile(taskPath, "utf-8");
      return parseTaskPlanMarkdown({
        content,
        taskDir,
        taskPath,
        layoutContent,
      });
    }),
  );
}

export async function writeTaskPlanIfChanged(task: ParsedTaskPlan): Promise<void> {
  const next = renderParsedTaskPlanMarkdown(task);
  const current = await fs.readFile(task.path, "utf-8");
  if (current !== next) {
    await fs.writeFile(task.path, next, "utf-8");
  }
}

function formatPlanArchiveTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1Z");
}

export async function archiveTaskPlanSnapshot(params: {
  task: ParsedTaskPlan;
  now?: Date;
}): Promise<string> {
  const now = params.now ?? new Date();
  const historyDir = path.join(path.dirname(params.task.path), "history");
  const current = await fs.readFile(params.task.path, "utf-8");
  await fs.mkdir(historyDir, { recursive: true });

  const timestamp = formatPlanArchiveTimestamp(now);
  let attempt = 1;
  while (true) {
    const suffix = attempt === 1 ? "" : `-${String(attempt).padStart(2, "0")}`;
    const archivePath = path.join(historyDir, `plan-${timestamp}${suffix}.md`);
    try {
      await fs.access(archivePath);
      attempt += 1;
      continue;
    } catch {
      await fs.writeFile(archivePath, current, "utf-8");
      return archivePath;
    }
  }
}

export function resolveTaskRole(
  task: ParsedTaskPlan,
  state: ResearchWorkspaceState,
): ResearchRoleName {
  if (state.forceReplanTaskId === task.id) {
    return "step_planner";
  }
  if (!hasActionablePlanItems(task) || hasMeaningfulEntries(task.blockers)) {
    return "step_planner";
  }
  return task.workerType === "writing" ? "writing_agent" : "coding_agent";
}

function parseExecutorReport(params: {
  rawStdout: string;
  rawStderr: string;
  exitCode: number | null;
  expectedTaskId: string;
}): ResearchRoleResult {
  void params.expectedTaskId;
  const stdoutBrief = parseWorkerStdoutBrief(params.rawStdout);
  return {
    status: stdoutBrief.result,
    summary: stdoutBrief.summary,
    updated_files: [],
    needs_replan: stdoutBrief.result === "blocked",
    needs_long_job: false,
    long_job_request: "",
    artifacts: [],
    rawStdout: params.rawStdout,
    rawStderr: params.rawStderr,
    exitCode: params.exitCode,
    stdoutBrief,
  };
}

export async function defaultRoleRunner(params: {
  role: ResearchRoleName;
  workspaceDir: string;
  taskId: string;
  prompt: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ResearchRoleResult> {
  void params.env;
  const roleWorkspaceDir = resolveRoleWorkspaceDir(params.workspaceDir, params.role);
  const runId = `research-${params.taskId}-${params.role}-${Date.now()}`;
  const sessionFile = path.join(roleWorkspaceDir, ".research-role-session.jsonl");
  const result = await runCliAgent({
    sessionId: runId,
    sessionFile,
    workspaceDir: roleWorkspaceDir,
    prompt: params.prompt,
    provider: "codex-cli",
    model: "gpt-5.2-codex",
    timeoutMs: 30 * 60 * 1000,
    runId,
    allowNonZeroExit: true,
  });
  const processResult = result.meta.processResult;
  const rawStdout =
    typeof processResult?.stdout === "string"
      ? processResult.stdout
      : (result.payloads?.map((payload) => payload.text ?? "").find((text) => text.trim()) ?? "");
  const rawStderr = typeof processResult?.stderr === "string" ? processResult.stderr : "";
  const exitCode = typeof processResult?.exitCode === "number" ? processResult.exitCode : 0;
  if (!rawStdout.trim()) {
    throw new Error(`Role runner returned no stdout for ${params.role} on ${params.taskId}.`);
  }
  return parseExecutorReport({
    rawStdout,
    rawStderr,
    exitCode,
    expectedTaskId: params.taskId,
  });
}

export { buildTaskPrompt };
