import { describe, expect, it } from "vitest";
import { resolveTaskRole } from "./roles.js";

describe("resolveTaskRole", () => {
  it("uses explicit worker types instead of title keywords", () => {
    const writingTask = {
      id: "T05",
      title: "Finalize citations",
      workerType: "writing" as const,
      status: "pending" as const,
      objective: "Polish manuscript references.",
      acceptance: ["References are aligned"],
      steps: [],
      sectionQueue: [
        {
          id: "W01",
          status: "pending" as const,
          sectionId: "S01",
          sectionSlug: "introduction",
          materialsDir: "section_materials/introduction/",
          manuscriptPath: "manuscript/sections/introduction.tex",
          acceptance: "补一轮 introduction 引用。",
        },
      ],
      blockers: [],
      lastRunResult: "暂无",
      nextActionHint: "从 W01 开始。",
      dir: "tasks/T05",
      path: "tasks/T05/plan.md",
    };

    const codingTask = {
      ...writingTask,
      id: "T02",
      title: "Write benchmark script",
      workerType: "coding" as const,
      steps: [
        {
          id: "S01",
          status: "pending" as const,
          task: "补 benchmark 脚本。",
          acceptance: "脚本可运行。",
        },
      ],
      sectionQueue: [],
      dir: "tasks/T02",
      path: "tasks/T02/plan.md",
    };

    expect(resolveTaskRole(writingTask, { version: 1, updatedAt: new Date(0).toISOString() })).toBe(
      "writing_agent",
    );
    expect(resolveTaskRole(codingTask, { version: 1, updatedAt: new Date(0).toISOString() })).toBe(
      "coding_agent",
    );
  });
});
