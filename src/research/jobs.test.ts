import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  launchPreparedLongResearchJob,
  researchSuperviseJobCommand,
  validatePreparedLongJobArtifacts,
} from "./jobs.js";
import { initializeTaskArtifactScaffold } from "./workspace.js";

const createdDirs: string[] = [];

async function makeTempDir(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => await fs.rm(dir, { recursive: true, force: true })),
  );
});

async function writeExecutable(filePath: string, content: string) {
  await fs.writeFile(filePath, content, "utf-8");
  await fs.chmod(filePath, 0o755);
}

async function prepareCodingPlan(root: string, taskId: string) {
  const taskDir = path.join(root, "tasks", taskId);
  await initializeTaskArtifactScaffold(root, `tasks/${taskId}`);
  await fs.writeFile(path.join(root, "layout.md"), "# layout\n", "utf-8");
  await fs.writeFile(
    path.join(taskDir, "plan.md"),
    [
      `# ${taskId} Long Evaluation`,
      "",
      "## Worker Type",
      "coding",
      "",
      "## 状态",
      "in_progress",
      "",
      "## 目标",
      "准备并跟踪长任务。",
      "",
      "## 验收标准",
      "- 长任务结果已落盘",
      "",
      "## Step List",
      "",
      "### S01",
      "- status: in_progress",
      "- task: 运行后台评测",
      "- acceptance: 结果可读取",
      "",
      "## Blockers",
      "",
      "- 暂无",
      "",
      "## 最近执行结果",
      "",
      "- 尚未执行",
      "",
      "## Next Action Hint",
      "",
      "- 准备后台作业。",
      "",
    ].join("\n"),
    "utf-8",
  );
}

describe("research long jobs", () => {
  it("validates prepared long-job artifacts and launch.sh execute bit", async () => {
    const root = await makeTempDir("openclaw-long-job-");
    await prepareCodingPlan(root, "T07");
    const taskDir = path.join(root, "tasks", "T07");
    const launchPath = path.join(taskDir, "launch.sh");
    const jobPath = path.join(taskDir, "job.json");

    await writeExecutable(launchPath, "#!/usr/bin/env bash\nexit 0\n");
    await fs.writeFile(
      jobPath,
      `${JSON.stringify(
        {
          version: 1,
          taskId: "T07",
          jobId: "eval-01",
          status: "prepared",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:00:00.000Z",
          launchPath: "tasks/T07/launch.sh",
          outputDir: "tasks/T07/outputs/long-run",
          logPath: "tasks/T07/logs/run.log",
          summary: "后台评测待启动。",
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    const job = await validatePreparedLongJobArtifacts({
      workspaceDir: root,
      taskDir: "tasks/T07",
    });

    expect(job?.jobId).toBe("eval-01");
    expect(job?.status).toBe("prepared");
  });

  it("launches a prepared long job and keeps job.json as the machine-readable status source", async () => {
    const root = await makeTempDir("openclaw-long-job-launch-");
    await prepareCodingPlan(root, "T08");
    const taskDir = path.join(root, "tasks", "T08");
    const launchPath = path.join(taskDir, "launch.sh");
    const jobPath = path.join(taskDir, "job.json");

    await fs.writeFile(
      jobPath,
      `${JSON.stringify(
        {
          version: 1,
          taskId: "T08",
          jobId: "train-01",
          status: "prepared",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:00:00.000Z",
          launchPath: "tasks/T08/launch.sh",
          outputDir: "tasks/T08/outputs/train-01",
          logPath: "tasks/T08/logs/run.log",
          summary: "准备提交训练作业。",
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    await writeExecutable(
      launchPath,
      [
        "#!/usr/bin/env bash",
        "cat <<'EOF' > \"$PWD/job.json\"",
        JSON.stringify(
          {
            version: 1,
            taskId: "T08",
            jobId: "train-01",
            status: "running",
            createdAt: "2026-03-22T00:00:00.000Z",
            updatedAt: "2026-03-22T00:05:00.000Z",
            launchPath: "tasks/T08/launch.sh",
            outputDir: "tasks/T08/outputs/train-01",
            logPath: "tasks/T08/logs/run.log",
            summary: "训练作业已启动。",
            pid: 4321,
            startedAt: "2026-03-22T00:05:00.000Z",
          },
          null,
          2,
        ),
        "EOF",
      ].join("\n"),
    );

    const jobPathResult = await launchPreparedLongResearchJob({
      workspaceDir: root,
      taskId: "T08",
      now: new Date("2026-03-22T00:05:00.000Z"),
    });

    const job = JSON.parse(await fs.readFile(jobPath, "utf-8")) as { status: string; pid?: number };
    expect(jobPathResult).toBe(jobPath);
    expect(job.status).toBe("running");
    expect(job.pid).toBe(4321);
  });

  it("finalizes a completed long job, updates plan.md, and wakes the main session", async () => {
    const root = await makeTempDir("openclaw-long-job-supervisor-");
    await prepareCodingPlan(root, "T09");
    const taskDir = path.join(root, "tasks", "T09");
    const jobPath = path.join(taskDir, "job.json");
    const monitorPath = path.join(taskDir, "monitor.sh");
    const wakeMainSession = vi.fn().mockResolvedValue(undefined);

    await fs.mkdir(path.join(taskDir, "outputs", "long-run"), { recursive: true });
    await fs.writeFile(
      jobPath,
      `${JSON.stringify(
        {
          version: 1,
          taskId: "T09",
          jobId: "eval-09",
          status: "running",
          createdAt: "2026-03-22T00:00:00.000Z",
          updatedAt: "2026-03-22T00:00:00.000Z",
          launchPath: "tasks/T09/launch.sh",
          outputDir: "tasks/T09/outputs/long-run",
          logPath: "tasks/T09/logs/run.log",
          summary: "后台评测已结束。",
          monitorPath: "tasks/T09/monitor.sh",
          wakeOnComplete: true,
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    await writeExecutable(
      monitorPath,
      [
        "#!/usr/bin/env bash",
        "cat <<'EOF' > \"$PWD/job.json\"",
        JSON.stringify(
          {
            version: 1,
            taskId: "T09",
            jobId: "eval-09",
            status: "succeeded",
            createdAt: "2026-03-22T00:00:00.000Z",
            updatedAt: "2026-03-22T00:10:00.000Z",
            launchPath: "tasks/T09/launch.sh",
            outputDir: "tasks/T09/outputs/long-run",
            logPath: "tasks/T09/logs/run.log",
            summary: "后台评测已结束。",
            monitorPath: "tasks/T09/monitor.sh",
            finishedAt: "2026-03-22T00:10:00.000Z",
            wakeOnComplete: true,
          },
          null,
          2,
        ),
        "EOF",
      ].join("\n"),
    );

    await researchSuperviseJobCommand(
      { log: vi.fn() },
      {
        workspace: root,
        taskId: "T09",
        now: new Date("2026-03-22T00:10:00.000Z"),
        wakeMainSession,
      },
    );

    const planMd = await fs.readFile(path.join(taskDir, "plan.md"), "utf-8");
    const summaryMd = await fs.readFile(path.join(taskDir, "summary.md"), "utf-8");
    const resultJson = JSON.parse(
      await fs.readFile(path.join(taskDir, "outputs", "result.json"), "utf-8"),
    ) as { success: boolean; status: string };

    expect(planMd).toContain("后台评测已结束");
    expect(summaryMd).toContain("long_job_status: succeeded");
    expect(resultJson).toMatchObject({ success: true, status: "succeeded" });
    expect(wakeMainSession).toHaveBeenCalledWith({ json: undefined });
  });
});
