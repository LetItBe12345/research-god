import { describe, expect, it } from "vitest";
import { buildTaskPrompt } from "./prompts.js";

describe("research task prompts", () => {
  it("spells out the writing section injection contract", () => {
    const prompt = buildTaskPrompt({
      role: "writing_agent",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace/agents/writing",
      task: {
        id: "T09",
        title: "Draft the introduction",
        dir: "tasks/T09",
        workerType: "writing",
        sectionQueue: [
          {
            id: "W01",
            status: "pending",
            sectionSlug: "introduction",
            materialsDir: "section_materials/introduction",
            manuscriptPath: "manuscript/sections/introduction.tex",
          },
        ],
      },
    });

    expect(prompt).toContain("本轮必须注入的当前 section 材料");
    expect(prompt).toContain("AGENTS.md");
    expect(prompt).toContain("../../tasks/T09/writing_packages/W01.md");
    expect(prompt).toContain("../../section_materials/introduction/brief.md");
    expect(prompt).toContain("../../manuscript/sections/introduction.tex");
    expect(prompt).toContain(
      "source section Markdown 集合：以当前 section task package 中列出的路径为准",
    );
    expect(prompt).toContain("一次只写一个 section");
    expect(prompt).toContain("必须先读 `agents/writing/AGENTS.md` 与当前 section task package");
    expect(prompt).toContain("只有当 task package / brief.md 明确声明时");
    expect(prompt).toContain("不要跨 section 发散");
    expect(prompt).toContain("写作正文必须是 LaTeX section 文件");
    expect(prompt).toContain("只能使用当前材料里真实存在的 cite key，并写成 `\\cite{key}`");
    expect(prompt).toContain("补写 `runtime/session_notes.md`");
    expect(prompt).toContain("`stdout` 只做本轮简报，不做长期状态存储");
    expect(prompt).toContain("LaTeX sanity check");
    expect(prompt).toContain("4 行短报告：`RESULT`、`SUMMARY`、`PLAN_UPDATE`、`NEXT_HINT`");
  });

  it("keeps step planner aligned with layout-driven writing order", () => {
    const prompt = buildTaskPrompt({
      role: "step_planner",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace/agents/step_planner",
      task: {
        id: "T09",
        title: "Plan writing queue",
        dir: "tasks/T09",
        workerType: "writing",
        sectionQueue: [
          {
            id: "W01",
            status: "pending",
            sectionSlug: "abstract",
            materialsDir: "section_materials/abstract",
            manuscriptPath: "manuscript/sections/abstract.tex",
          },
        ],
      },
    });

    expect(prompt).toContain("Section Queue 必须保持与 layout.md 一致");
    expect(prompt).toContain("按固定顺序一次只推进一个 section");
    expect(prompt).toContain("不要修改论文，也不要修改顶层 todo.md");
    expect(prompt).toContain("`stdout` 只做本轮简报，不做长期状态存储");
    expect(prompt).toContain("`PLAN_UPDATE` 必须概括你刚刚写入 `plan.md` 的更新");
  });

  it("requires coding workers to leave the minimal result set behind", () => {
    const prompt = buildTaskPrompt({
      role: "coding_agent",
      workspaceDir: "/tmp/workspace",
      agentWorkspaceDir: "/tmp/workspace/agents/coding",
      task: {
        id: "T03",
        title: "Run the experiment slice",
        dir: "tasks/T03",
        workerType: "coding",
      },
    });

    expect(prompt).toContain("../../tasks/T03/summary.md");
    expect(prompt).toContain("../../tasks/T03/outputs/result.json");
    expect(prompt).toContain("../../tasks/T03/logs/run.log");
    expect(prompt).toContain("至少包含 taskId、status、summary");
    expect(prompt).toContain("失败时也要保留已有输出");
  });
});
