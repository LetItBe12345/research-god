import { execFile, spawn, type SpawnOptions } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseTaskPlanMarkdown } from "./parsing.js";
import { renderParsedTaskPlanMarkdown } from "./render.js";
import {
  ResearchLongJobSchema,
  type ResearchLongJob,
  type ResearchSuperviseJobOptions,
} from "./types.js";
import { resolveTaskArtifactPaths } from "./workspace.js";

const execFileAsync = promisify(execFile);
const OPENCLAW_ENTRY_PATH = fileURLToPath(new URL("../../openclaw.mjs", import.meta.url));
const LONG_JOB_WAKE_TEXT =
  "实验已经执行完毕。请读取 AGENTS.md、当前 task 的 plan.md、summary.md、outputs/ 与必要日志，并据此进行下一步计划；本轮只选择恰好一个 next action。";

const TERMINAL_LONG_JOB_STATUSES = new Set<ResearchLongJob["status"]>([
  "succeeded",
  "failed",
  "blocked",
]);
const ACTIVE_LONG_JOB_STATUSES = new Set<ResearchLongJob["status"]>(["launching", "running"]);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeJobStatus(raw: string | undefined): ResearchLongJob["status"] {
  if (raw === "done") {
    return "succeeded";
  }
  if (raw === "error") {
    return "failed";
  }
  if (
    raw === "prepared" ||
    raw === "launching" ||
    raw === "running" ||
    raw === "succeeded" ||
    raw === "failed" ||
    raw === "blocked"
  ) {
    return raw;
  }
  return "blocked";
}

function isPlaceholder(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === "暂无" || trimmed === "none";
}

function summarizeLongJob(job: ResearchLongJob): string {
  if (job.status === "succeeded") {
    return job.summary.trim() || `长任务 ${job.jobId} 已完成。`;
  }
  if (job.status === "failed") {
    return job.summary.trim() || `长任务 ${job.jobId} 失败。`;
  }
  if (job.status === "blocked") {
    return job.summary.trim() || `长任务 ${job.jobId} 被阻塞。`;
  }
  return job.summary.trim() || `长任务 ${job.jobId} 仍在运行。`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runSpawnedProcess(
  command: string,
  args: string[],
  options: SpawnOptions,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "null"}.`));
    });
  });
}

export function isPreparedLongJob(job: ResearchLongJob): boolean {
  return job.status === "prepared";
}

export function isTerminalLongJob(job: ResearchLongJob): boolean {
  return TERMINAL_LONG_JOB_STATUSES.has(job.status);
}

export function isActiveLongJob(job: ResearchLongJob): boolean {
  return ACTIVE_LONG_JOB_STATUSES.has(job.status);
}

export async function readResearchLongJob(jobPath: string): Promise<ResearchLongJob> {
  const raw = JSON.parse(await fs.readFile(jobPath, "utf-8")) as unknown;
  return ResearchLongJobSchema.parse(raw);
}

export async function tryReadResearchLongJob(
  jobPath: string,
): Promise<ResearchLongJob | undefined> {
  try {
    return await readResearchLongJob(jobPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function writeResearchLongJob(jobPath: string, job: ResearchLongJob): Promise<void> {
  await fs.writeFile(jobPath, `${JSON.stringify(job, null, 2)}\n`, "utf-8");
}

export async function validatePreparedLongJobArtifacts(params: {
  workspaceDir: string;
  taskDir: string;
}): Promise<ResearchLongJob | undefined> {
  const paths = resolveTaskArtifactPaths(params.workspaceDir, params.taskDir);
  const job = await tryReadResearchLongJob(paths.jobPath);
  if (!job) {
    return undefined;
  }
  if (!(await pathExists(paths.launchPath))) {
    throw new Error(`${params.taskDir}/job.json exists but launch.sh is missing.`);
  }
  const launchStats = await fs.stat(paths.launchPath);
  if ((launchStats.mode & 0o111) === 0) {
    throw new Error(`${params.taskDir}/launch.sh must be executable for long jobs.`);
  }
  if (job.launchPath !== path.posix.join(params.taskDir, "launch.sh")) {
    throw new Error(`${params.taskDir}/job.json must point to ${params.taskDir}/launch.sh.`);
  }
  if (!job.outputDir.startsWith(`${params.taskDir}/`)) {
    throw new Error(`${params.taskDir}/job.json outputDir must stay under the current task.`);
  }
  if (!job.logPath.startsWith(`${params.taskDir}/`)) {
    throw new Error(`${params.taskDir}/job.json logPath must stay under the current task.`);
  }
  if (job.monitorPath && job.monitorPath !== path.posix.join(params.taskDir, "monitor.sh")) {
    throw new Error(
      `${params.taskDir}/job.json monitorPath must point to monitor.sh when present.`,
    );
  }
  return job;
}

export async function launchPreparedLongResearchJob(params: {
  workspaceDir: string;
  taskId: string;
  json?: boolean;
  now?: Date;
}): Promise<string> {
  const taskDir = path.posix.join("tasks", params.taskId);
  const taskPaths = resolveTaskArtifactPaths(params.workspaceDir, taskDir);
  const initialJob = await validatePreparedLongJobArtifacts({
    workspaceDir: params.workspaceDir,
    taskDir,
  });
  if (!initialJob) {
    throw new Error(`${taskDir} has no prepared long job.`);
  }
  if (!isPreparedLongJob(initialJob)) {
    return taskPaths.jobPath;
  }
  const now = params.now ?? new Date();
  await writeResearchLongJob(taskPaths.jobPath, {
    ...initialJob,
    status: "launching",
    updatedAt: now.toISOString(),
    summary: initialJob.summary.trim() || "长任务已提交，等待后台执行。",
  });
  await runSpawnedProcess(taskPaths.launchPath, [], {
    cwd: taskPaths.taskDir,
    env: process.env,
    stdio: "ignore",
  });
  const launchedJob = (await tryReadResearchLongJob(taskPaths.jobPath)) ?? initialJob;
  if (!isPreparedLongJob(launchedJob) && launchedJob.status !== "launching") {
    return taskPaths.jobPath;
  }
  await writeResearchLongJob(taskPaths.jobPath, {
    ...launchedJob,
    status: "running",
    startedAt: launchedJob.startedAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    summary: launchedJob.summary.trim() || "长任务已由主会话发起，等待 supervisor 收尾。",
  });
  return taskPaths.jobPath;
}

export async function startDetachedLongResearchJobSupervisor(params: {
  workspaceDir: string;
  taskId: string;
  json?: boolean;
}): Promise<void> {
  const args = [
    OPENCLAW_ENTRY_PATH,
    "research",
    "supervise-job",
    "--workspace",
    params.workspaceDir,
    "--task",
    params.taskId,
  ];
  if (params.json) {
    args.push("--json");
  }
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function inferTerminalStatusFromResultJson(
  resultJsonPath: string,
): Promise<ResearchLongJob["status"] | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(resultJsonPath, "utf-8")) as {
      success?: boolean;
      status?: string;
    };
    if (typeof raw.success === "boolean") {
      return raw.success ? "succeeded" : "failed";
    }
    if (typeof raw.status === "string") {
      return normalizeJobStatus(raw.status);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function probeServiceStatus(
  serviceName: string,
): Promise<ResearchLongJob["status"] | undefined> {
  try {
    const { stdout } = await execFileAsync("systemctl", ["--user", "is-active", serviceName], {
      encoding: "utf8",
    });
    const normalized = stdout.trim().toLowerCase();
    if (normalized === "active" || normalized === "activating") {
      return "running";
    }
    if (normalized === "failed") {
      return "failed";
    }
    if (normalized === "inactive") {
      return "succeeded";
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function probePidStatus(pid: number): Promise<ResearchLongJob["status"]> {
  try {
    process.kill(pid, 0);
    return "running";
  } catch {
    return "succeeded";
  }
}

async function observeLongJobStatus(params: {
  job: ResearchLongJob;
  workspaceDir: string;
}): Promise<ResearchLongJob["status"] | undefined> {
  if (isTerminalLongJob(params.job)) {
    return params.job.status;
  }
  const taskPaths = resolveTaskArtifactPaths(
    params.workspaceDir,
    path.posix.join("tasks", params.job.taskId),
  );
  const resultStatus = await inferTerminalStatusFromResultJson(taskPaths.resultJsonPath);
  if (resultStatus && resultStatus !== "running") {
    return resultStatus;
  }
  if (params.job.serviceName) {
    const serviceStatus = await probeServiceStatus(params.job.serviceName);
    if (serviceStatus) {
      return serviceStatus;
    }
  }
  if (typeof params.job.pid === "number") {
    return await probePidStatus(params.job.pid);
  }
  return resultStatus;
}

async function updateTaskPlanAfterLongJob(params: {
  workspaceDir: string;
  taskId: string;
  summary: string;
  status: ResearchLongJob["status"];
}): Promise<void> {
  const taskDir = path.posix.join("tasks", params.taskId);
  const taskPaths = resolveTaskArtifactPaths(params.workspaceDir, taskDir);
  const [planMarkdown, layoutMarkdown] = await Promise.all([
    fs.readFile(taskPaths.planPath, "utf-8"),
    fs.readFile(path.join(params.workspaceDir, "layout.md"), "utf-8").catch(() => ""),
  ]);
  const parsed = parseTaskPlanMarkdown({
    content: planMarkdown,
    taskDir,
    taskPath: taskPaths.planPath,
    layoutContent: layoutMarkdown,
  });
  parsed.lastRunResult = params.summary;
  parsed.nextActionHint = "等待主会话重读 workspace 并决定下一步。";
  const blockers = parsed.blockers.filter(
    (entry) => !isPlaceholder(entry) && !entry.includes("长任务"),
  );
  if (params.status === "succeeded") {
    parsed.blockers = blockers;
  } else {
    parsed.blockers = [...blockers, params.summary];
  }
  await fs.writeFile(taskPaths.planPath, renderParsedTaskPlanMarkdown(parsed), "utf-8");
}

async function finalizeLongJob(params: {
  workspaceDir: string;
  jobPath: string;
  job: ResearchLongJob;
  now: Date;
  wakeMainSession?: (params: { json?: boolean }) => Promise<void>;
  json?: boolean;
}): Promise<ResearchLongJob> {
  const taskDir = path.posix.join("tasks", params.job.taskId);
  const taskPaths = resolveTaskArtifactPaths(params.workspaceDir, taskDir);
  const resultStatus =
    (await inferTerminalStatusFromResultJson(taskPaths.resultJsonPath)) ?? params.job.status;
  const finalStatus = isTerminalLongJob(params.job)
    ? params.job.status
    : resultStatus === "running" || resultStatus === "launching" || resultStatus === "prepared"
      ? "blocked"
      : resultStatus;
  const summary = summarizeLongJob({
    ...params.job,
    status: finalStatus,
  });
  const finalizedJob: ResearchLongJob = {
    ...params.job,
    status: finalStatus,
    summary,
    updatedAt: params.now.toISOString(),
    finishedAt: params.job.finishedAt ?? params.now.toISOString(),
  };
  await Promise.all([
    writeResearchLongJob(params.jobPath, finalizedJob),
    fs.writeFile(
      taskPaths.summaryPath,
      `# Summary\n\n- ${summary}\n- long_job_status: ${finalizedJob.status}\n`,
      "utf-8",
    ),
    fs.writeFile(
      taskPaths.resultJsonPath,
      `${JSON.stringify(
        {
          taskId: finalizedJob.taskId,
          success: finalizedJob.status === "succeeded",
          status: finalizedJob.status,
          summary,
          command: finalizedJob.command ?? finalizedJob.jobId,
          output_paths: finalizedJob.outputPaths ?? [finalizedJob.outputDir],
          metrics: {},
        },
        null,
        2,
      )}\n`,
      "utf-8",
    ),
    fs.appendFile(
      taskPaths.runLogPath,
      `[long-job:${finalizedJob.status}] ${params.now.toISOString()} ${summary}\n`,
      "utf-8",
    ),
    updateTaskPlanAfterLongJob({
      workspaceDir: params.workspaceDir,
      taskId: finalizedJob.taskId,
      summary,
      status: finalizedJob.status,
    }),
  ]);
  if (finalizedJob.wakeOnComplete !== false) {
    const wake = params.wakeMainSession;
    if (!wake) {
      throw new Error("wakeMainSession is required to finalize a long job.");
    }
    await wake({ json: params.json });
  }
  return finalizedJob;
}

export async function researchSuperviseJobCommand(
  runtime: { log: (message: string) => void },
  opts: ResearchSuperviseJobOptions,
): Promise<ResearchLongJob> {
  const cwd = opts.cwd ?? process.cwd();
  const workspaceDir = opts.workspace ? path.resolve(cwd, opts.workspace) : cwd;
  const taskPaths = resolveTaskArtifactPaths(workspaceDir, path.posix.join("tasks", opts.taskId));
  let job = await readResearchLongJob(taskPaths.jobPath);

  if (job.monitorPath) {
    const monitorAbsolutePath = path.join(workspaceDir, job.monitorPath);
    if (await pathExists(monitorAbsolutePath)) {
      await runSpawnedProcess(monitorAbsolutePath, [], {
        cwd: taskPaths.taskDir,
        env: process.env,
        stdio: "ignore",
      });
      job = await readResearchLongJob(taskPaths.jobPath);
    }
  }

  const wait = opts.sleep ?? sleep;
  while (!isTerminalLongJob(job)) {
    const observedStatus = await observeLongJobStatus({ job, workspaceDir });
    if (observedStatus && observedStatus !== job.status) {
      job = {
        ...job,
        status: observedStatus,
        updatedAt: (opts.now ?? new Date()).toISOString(),
      };
      await writeResearchLongJob(taskPaths.jobPath, job);
      if (isTerminalLongJob(job)) {
        break;
      }
    }
    await wait(250);
    job = await readResearchLongJob(taskPaths.jobPath);
  }

  const finalized = await finalizeLongJob({
    workspaceDir,
    jobPath: taskPaths.jobPath,
    job,
    now: opts.now ?? new Date(),
    wakeMainSession: opts.wakeMainSession,
    json: opts.json,
  });
  runtime.log(opts.json ? JSON.stringify(finalized, null, 2) : finalized.summary);
  return finalized;
}

export { LONG_JOB_WAKE_TEXT };
