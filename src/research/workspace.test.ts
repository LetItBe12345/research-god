import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeTaskArtifactScaffold, resolveTaskArtifactPaths } from "./workspace.js";

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

describe("task artifact scaffold", () => {
  it("creates the minimal coding result files without clobbering existing data", async () => {
    const root = await makeTempDir("openclaw-task-scaffold-");
    const taskDir = "tasks/T12";
    const paths = await initializeTaskArtifactScaffold(root, taskDir);

    expect(await fs.readFile(paths.summaryPath, "utf-8")).toContain("暂无执行结果");
    expect(JSON.parse(await fs.readFile(paths.resultJsonPath, "utf-8"))).toMatchObject({
      taskId: "T12",
      status: "pending",
    });
    expect(await fs.readFile(paths.runLogPath, "utf-8")).toBe("");

    await fs.writeFile(paths.summaryPath, "# Summary\n\n- custom\n", "utf-8");
    await initializeTaskArtifactScaffold(root, taskDir);

    expect(await fs.readFile(paths.summaryPath, "utf-8")).toContain("custom");
  });

  it("resolves task artifact paths under outputs and logs", () => {
    const paths = resolveTaskArtifactPaths("/tmp/workspace", "tasks/T07");

    expect(paths.summaryPath).toBe("/tmp/workspace/tasks/T07/summary.md");
    expect(paths.resultJsonPath).toBe("/tmp/workspace/tasks/T07/outputs/result.json");
    expect(paths.runLogPath).toBe("/tmp/workspace/tasks/T07/logs/run.log");
    expect(paths.launchPath).toBe("/tmp/workspace/tasks/T07/launch.sh");
    expect(paths.jobPath).toBe("/tmp/workspace/tasks/T07/job.json");
  });
});
