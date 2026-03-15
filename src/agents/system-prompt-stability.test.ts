import { describe, expect, it, beforeEach } from "vitest";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";
import {
  loadWorkspaceBootstrapFiles,
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
} from "./workspace.js";

describe("system prompt stability for cache hits", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await makeTempWorkspace("openclaw-system-prompt-stability-");
  });

  it("returns identical results for same inputs across multiple calls", async () => {
    const agentsContent = "# AGENTS.md - Your Workspace\n\nTest agents file.";
    const heartbeatContent = "# HEARTBEAT.md\n\nTest heartbeat file.";

    // Write workspace files
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: DEFAULT_AGENTS_FILENAME,
      content: agentsContent,
    });
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: DEFAULT_HEARTBEAT_FILENAME,
      content: heartbeatContent,
    });

    // Load the same workspace multiple times
    const results = await Promise.all([
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
    ]);

    // All results should be structurally identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }

    // Verify specific content consistency
    const agentsFiles = results.map((result) =>
      result.find((f) => f.name === DEFAULT_AGENTS_FILENAME),
    );
    const heartbeatFiles = results.map((result) =>
      result.find((f) => f.name === DEFAULT_HEARTBEAT_FILENAME),
    );

    // All instances should have identical content
    for (let i = 1; i < agentsFiles.length; i++) {
      expect(agentsFiles[i]?.content).toBe(agentsFiles[0]?.content);
      expect(heartbeatFiles[i]?.content).toBe(heartbeatFiles[0]?.content);
    }

    // Verify the actual content matches what we wrote
    expect(agentsFiles[0]?.content).toBe(agentsContent);
    expect(heartbeatFiles[0]?.content).toBe(heartbeatContent);
  });

  it("returns consistent ordering across calls", async () => {
    const testFiles = [
      { name: DEFAULT_AGENTS_FILENAME, content: "# Agents content" },
      { name: DEFAULT_HEARTBEAT_FILENAME, content: "# Heartbeat content" },
    ];

    // Write all test files
    for (const file of testFiles) {
      await writeWorkspaceFile({ dir: workspaceDir, name: file.name, content: file.content });
    }

    // Load multiple times
    const results = await Promise.all([
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
    ]);

    // All results should have the same file order
    for (let i = 1; i < results.length; i++) {
      const names1 = results[0].map((f) => f.name);
      const namesI = results[i].map((f) => f.name);
      expect(namesI).toEqual(names1);
    }
  });

  it("maintains consistency even with missing files", async () => {
    // Only create some files, leave others missing
    await writeWorkspaceFile({
      dir: workspaceDir,
      name: DEFAULT_AGENTS_FILENAME,
      content: "# Agents only",
    });

    // Load multiple times
    const results = await Promise.all([
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
      loadWorkspaceBootstrapFiles(workspaceDir),
    ]);

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }

    // Verify missing files are consistently marked as missing
    for (const result of results) {
      const agentsFile = result.find((f) => f.name === DEFAULT_AGENTS_FILENAME);
      const heartbeatFile = result.find((f) => f.name === DEFAULT_HEARTBEAT_FILENAME);

      expect(agentsFile?.missing).toBe(false);
      expect(agentsFile?.content).toBe("# Agents only");
      expect(heartbeatFile?.missing).toBe(true);
      expect(heartbeatFile?.content).toBeUndefined();
    }
  });

  it("maintains consistency across concurrent loads", async () => {
    const content = "# Concurrent load test";
    await writeWorkspaceFile({ dir: workspaceDir, name: DEFAULT_AGENTS_FILENAME, content });

    // Start multiple concurrent loads
    const promises = Array.from({ length: 20 }, () => loadWorkspaceBootstrapFiles(workspaceDir));

    const results = await Promise.all(promises);

    // All concurrent results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }

    // Verify content consistency
    for (const result of results) {
      const agentsFile = result.find((f) => f.name === DEFAULT_AGENTS_FILENAME);
      expect(agentsFile?.content).toBe(content);
      expect(agentsFile?.missing).toBe(false);
    }
  });
});
