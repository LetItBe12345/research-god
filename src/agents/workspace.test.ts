import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  ensureAgentWorkspace,
  filterBootstrapFilesForSession,
  loadWorkspaceBootstrapFiles,
  resolveDefaultAgentWorkspaceDir,
  type WorkspaceBootstrapFile,
} from "./workspace.js";

describe("resolveDefaultAgentWorkspaceDir", () => {
  it("uses OPENCLAW_HOME for default workspace resolution", () => {
    const dir = resolveDefaultAgentWorkspaceDir({
      OPENCLAW_HOME: "/srv/openclaw-home",
      HOME: "/home/other",
    } as NodeJS.ProcessEnv);

    expect(dir).toBe(path.join(path.resolve("/srv/openclaw-home"), ".openclaw", "workspace"));
  });
});

const WORKSPACE_STATE_PATH_SEGMENTS = [".openclaw", "workspace-state.json"] as const;

async function readOnboardingState(dir: string): Promise<{
  version: number;
  bootstrapSeededAt?: string;
  onboardingCompletedAt?: string;
}> {
  const raw = await fs.readFile(path.join(dir, ...WORKSPACE_STATE_PATH_SEGMENTS), "utf-8");
  return JSON.parse(raw) as {
    version: number;
    bootstrapSeededAt?: string;
    onboardingCompletedAt?: string;
  };
}

async function expectBootstrapSeeded(dir: string) {
  await expect(fs.access(path.join(dir, DEFAULT_BOOTSTRAP_FILENAME))).rejects.toMatchObject({
    code: "ENOENT",
  });
  const state = await readOnboardingState(dir);
  expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
}

async function expectCompletedWithoutBootstrap(dir: string) {
  await expect(fs.access(path.join(dir, DEFAULT_HEARTBEAT_FILENAME))).resolves.toBeUndefined();
  await expect(fs.access(path.join(dir, DEFAULT_BOOTSTRAP_FILENAME))).rejects.toMatchObject({
    code: "ENOENT",
  });
  const state = await readOnboardingState(dir);
  expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
}

function expectSubagentAllowedBootstrapNames(files: WorkspaceBootstrapFile[]) {
  const names = files.map((file) => file.name);
  expect(names).toContain("AGENTS.md");
  expect(names).toContain("HEARTBEAT.md");
  expect(names).not.toContain("TOOLS.md");
  expect(names).not.toContain("SOUL.md");
  expect(names).not.toContain("IDENTITY.md");
  expect(names).not.toContain("USER.md");
  expect(names).not.toContain("BOOTSTRAP.md");
  expect(names).not.toContain("MEMORY.md");
}

describe("ensureAgentWorkspace", () => {
  it("marks brand new workspaces completed without creating BOOTSTRAP.md", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expectBootstrapSeeded(tempDir);
    await expect(
      fs.access(path.join(tempDir, DEFAULT_HEARTBEAT_FILENAME)),
    ).resolves.toBeUndefined();
  });

  it("recovers partial initialization without creating BOOTSTRAP.md", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_AGENTS_FILENAME, content: "existing" });

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expectBootstrapSeeded(tempDir);
  });

  it("does not recreate BOOTSTRAP.md after completion, even when AGENTS.md is recreated", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });
    await fs.unlink(path.join(tempDir, DEFAULT_AGENTS_FILENAME));

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.access(path.join(tempDir, DEFAULT_AGENTS_FILENAME))).resolves.toBeUndefined();
    const state = await readOnboardingState(tempDir);
    expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("does not re-seed BOOTSTRAP.md for legacy completed workspaces without state marker", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: DEFAULT_AGENTS_FILENAME, content: "custom" });

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(fs.access(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const state = await readOnboardingState(tempDir);
    expect(state.bootstrapSeededAt).toBeUndefined();
    expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("treats memory-backed workspaces as existing even when AGENTS.md and HEARTBEAT.md are missing", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await fs.mkdir(path.join(tempDir, "memory"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "memory", "2026-02-25.md"), "# Daily log\nSome notes");
    await fs.writeFile(path.join(tempDir, "MEMORY.md"), "# Long-term memory\nImportant stuff");

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expect(
      fs.access(path.join(tempDir, DEFAULT_HEARTBEAT_FILENAME)),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(tempDir, DEFAULT_BOOTSTRAP_FILENAME))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const state = await readOnboardingState(tempDir);
    expect(state.onboardingCompletedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    const memoryContent = await fs.readFile(path.join(tempDir, "MEMORY.md"), "utf-8");
    expect(memoryContent).toBe("# Long-term memory\nImportant stuff");
  });

  it("treats git-backed workspaces as existing even when template files are missing", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await fs.mkdir(path.join(tempDir, ".git"), { recursive: true });
    await fs.writeFile(path.join(tempDir, ".git", "HEAD"), "ref: refs/heads/main\n");

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    await expectCompletedWithoutBootstrap(tempDir);
  });
});

describe("loadWorkspaceBootstrapFiles", () => {
  it("loads only AGENTS.md and HEARTBEAT.md", async () => {
    const tempDir = await makeTempWorkspace("openclaw-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "AGENTS.md", content: "agents" });
    await writeWorkspaceFile({ dir: tempDir, name: "HEARTBEAT.md", content: "heartbeat" });
    await fs.writeFile(path.join(tempDir, "SOUL.md"), "soul", "utf-8");
    await fs.writeFile(path.join(tempDir, "MEMORY.md"), "memory", "utf-8");

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    expect(files.map((file) => file.name)).toEqual(["AGENTS.md", "HEARTBEAT.md"]);
    expect(files[0]?.content).toBe("agents");
    expect(files[1]?.content).toBe("heartbeat");
  });

  it("treats hardlinked bootstrap aliases as missing", async () => {
    if (process.platform === "win32") {
      return;
    }
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-workspace-hardlink-"));
    try {
      const workspaceDir = path.join(rootDir, "workspace");
      const outsideDir = path.join(rootDir, "outside");
      await fs.mkdir(workspaceDir, { recursive: true });
      await fs.mkdir(outsideDir, { recursive: true });
      const outsideFile = path.join(outsideDir, DEFAULT_AGENTS_FILENAME);
      const linkPath = path.join(workspaceDir, DEFAULT_AGENTS_FILENAME);
      await fs.writeFile(outsideFile, "outside", "utf-8");
      try {
        await fs.link(outsideFile, linkPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "EXDEV") {
          return;
        }
        throw err;
      }

      const files = await loadWorkspaceBootstrapFiles(workspaceDir);
      const agents = files.find((file) => file.name === DEFAULT_AGENTS_FILENAME);
      expect(agents?.missing).toBe(true);
      expect(agents?.content).toBeUndefined();
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

describe("filterBootstrapFilesForSession", () => {
  const mockFiles: WorkspaceBootstrapFile[] = [
    { name: "AGENTS.md", path: "/w/AGENTS.md", content: "", missing: false },
    { name: "HEARTBEAT.md", path: "/w/HEARTBEAT.md", content: "", missing: false },
    { name: "BOOTSTRAP.md", path: "/w/BOOTSTRAP.md", content: "", missing: false },
    { name: "MEMORY.md", path: "/w/MEMORY.md", content: "", missing: false },
  ];

  it("returns all files for main session (no sessionKey)", () => {
    const result = filterBootstrapFilesForSession(mockFiles);
    expect(result).toHaveLength(mockFiles.length);
  });

  it("returns all files for normal (non-subagent, non-cron) session key", () => {
    const result = filterBootstrapFilesForSession(mockFiles, "agent:default:chat:main");
    expect(result).toHaveLength(mockFiles.length);
  });

  it("filters to allowlist for subagent sessions", () => {
    const result = filterBootstrapFilesForSession(mockFiles, "agent:default:subagent:task-1");
    expectSubagentAllowedBootstrapNames(result);
  });

  it("filters to allowlist for cron sessions", () => {
    const result = filterBootstrapFilesForSession(mockFiles, "agent:default:cron:daily-check");
    expectSubagentAllowedBootstrapNames(result);
  });
});
