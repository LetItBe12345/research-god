import fs from "node:fs/promises";
import path from "node:path";
import { parseTaskPlanMarkdown, parseTopLevelTodoMarkdown } from "./parsing.js";
import { resolveParsedTaskStatus, resolveTaskRole } from "./roles.js";
import { normalizeWhitespace } from "./shared.js";
import type {
  ParsedTaskPlan,
  ResearchRoleName,
  ResearchTaskPlanSectionQueueItem,
  ResearchTodoItem,
  ResearchWorkspaceState,
} from "./types.js";
import { parseSectionBriefMarkdown } from "./writing.js";

type WorkspaceDispatchTaskSnapshot = {
  todoItem: ResearchTodoItem;
  task: ParsedTaskPlan;
  hasPlan: boolean;
  effectiveStatus: ParsedTaskPlan["status"];
};

export type WorkspaceDispatchResolution = {
  todoItems: ResearchTodoItem[];
  taskSnapshots: WorkspaceDispatchTaskSnapshot[];
  activeTask?: WorkspaceDispatchTaskSnapshot;
  role?: ResearchRoleName;
  completed: boolean;
  summary: string;
};

function taskDirFromTodoItem(item: ResearchTodoItem): string {
  const normalized = item.subtasksDir.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : `tasks/${item.id}`;
}

function makeTaskScaffold(item: ResearchTodoItem, workspaceDir: string): ParsedTaskPlan {
  const dir = taskDirFromTodoItem(item);
  return {
    id: item.id,
    title: item.title,
    workerType: item.workerType,
    status: item.status,
    objective: item.objective,
    acceptance: item.acceptance,
    steps: [],
    sectionQueue: [],
    blockers: [],
    lastRunResult: "暂无",
    nextActionHint: "暂无",
    dir,
    path: path.join(workspaceDir, dir, "plan.md"),
  };
}

function hasMeaningfulBlockers(entries: string[]): boolean {
  return entries.some((entry) => {
    const normalized = normalizeWhitespace(entry);
    return normalized.length > 0 && normalized !== "暂无";
  });
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isDirectory();
  } catch {
    return false;
  }
}

async function validateWritingMaterials(params: {
  workspaceDir: string;
  task: ParsedTaskPlan;
}): Promise<string | undefined> {
  const queueItem = params.task.sectionQueue.find((entry) => entry.status !== "done");
  if (!queueItem) {
    return "当前 Writing 任务的 Section Queue 没有可执行 section。";
  }
  return await validateWritingSection(params.workspaceDir, queueItem);
}

async function validateWritingSection(
  workspaceDir: string,
  queueItem: ResearchTaskPlanSectionQueueItem,
): Promise<string | undefined> {
  const normalizedMaterialsDir = queueItem.materialsDir.replace(/\/+$/, "");
  const materialsDir = path.join(workspaceDir, normalizedMaterialsDir);
  const briefPath = path.join(workspaceDir, normalizedMaterialsDir, "brief.md");
  const citationsPath = path.join(workspaceDir, normalizedMaterialsDir, "citations.md");
  const paper01Path = path.join(workspaceDir, normalizedMaterialsDir, "papers", "paper_01");
  const paper02Path = path.join(workspaceDir, normalizedMaterialsDir, "papers", "paper_02");
  const manuscriptOutputPath = path.join(workspaceDir, queueItem.manuscriptPath);
  const manuscriptOutputDir = path.dirname(manuscriptOutputPath);

  if (!(await isDirectory(materialsDir))) {
    return `缺少当前 section 的材料目录：${queueItem.materialsDir}`;
  }
  if (!(await pathExists(briefPath))) {
    return `缺少 Writing brief：${queueItem.materialsDir}/brief.md`;
  }
  if (!(await isDirectory(paper01Path)) || !(await isDirectory(paper02Path))) {
    return `Writing 前必须同时存在 ${queueItem.materialsDir}/papers/paper_01 和 paper_02。`;
  }
  if (!(await isDirectory(manuscriptOutputDir))) {
    return `目标 LaTeX 输出目录不存在：${path.relative(workspaceDir, manuscriptOutputDir).replace(/\\/g, "/")}`;
  }

  const brief = parseSectionBriefMarkdown(await fs.readFile(briefPath, "utf-8"));
  if (brief.latexOutputPath !== queueItem.manuscriptPath) {
    return `brief.md 的 latex_output_path 与 Section Queue 不一致：${brief.latexOutputPath ?? "missing"}`;
  }
  if (brief.sourceSectionPaths.length === 0) {
    return `brief.md 未声明可注入的 source section Markdown，不能派发 Writing。`;
  }

  for (const sourceSectionPath of brief.sourceSectionPaths) {
    if (
      !sourceSectionPath.startsWith(`${normalizedMaterialsDir}/papers/paper_01/source_sections/`) &&
      !sourceSectionPath.startsWith(`${normalizedMaterialsDir}/papers/paper_02/source_sections/`)
    ) {
      return `brief.md 引用了越界的 source section 路径：${sourceSectionPath}`;
    }
    const absolutePath = path.join(workspaceDir, sourceSectionPath);
    if (!(await pathExists(absolutePath))) {
      return `缺少 brief.md 所选的 source section Markdown：${sourceSectionPath}`;
    }
  }

  const needsCitationMaterials =
    brief.referencesBibPath !== undefined && brief.referencesBibPath.toLowerCase() !== "none";
  if (needsCitationMaterials) {
    if (!(await pathExists(path.join(workspaceDir, brief.referencesBibPath!)))) {
      return `缺少 Writing 所需的 references.bib：${brief.referencesBibPath}`;
    }
    if (!(await pathExists(citationsPath))) {
      return `缺少当前 section 的 citations.md：${queueItem.materialsDir}/citations.md`;
    }
  }
  if (
    brief.literatureReviewPath &&
    brief.literatureReviewPath.toLowerCase() !== "none" &&
    !(await pathExists(path.join(workspaceDir, brief.literatureReviewPath)))
  ) {
    return `缺少 brief.md 声明的 literature review：${brief.literatureReviewPath}`;
  }
  for (const experimentResultPath of brief.experimentResultPaths) {
    if (/[*?[\]{}]/.test(experimentResultPath)) {
      continue;
    }
    if (!(await pathExists(path.join(workspaceDir, experimentResultPath)))) {
      return `缺少 brief.md 声明的实验结果文件：${experimentResultPath}`;
    }
  }
  for (const existingTexPath of brief.existingTexPaths) {
    if (!(await pathExists(path.join(workspaceDir, existingTexPath)))) {
      return `缺少 brief.md 声明的已有 LaTeX 文件：${existingTexPath}`;
    }
  }

  return undefined;
}

async function loadTaskSnapshot(params: {
  workspaceDir: string;
  layoutContent: string;
  todoItem: ResearchTodoItem;
}): Promise<WorkspaceDispatchTaskSnapshot> {
  const task = makeTaskScaffold(params.todoItem, params.workspaceDir);
  try {
    const content = await fs.readFile(task.path, "utf-8");
    const parsed = parseTaskPlanMarkdown({
      content,
      taskDir: task.dir,
      taskPath: task.path,
      layoutContent: params.layoutContent,
    });
    return {
      todoItem: params.todoItem,
      task: parsed,
      hasPlan: true,
      effectiveStatus: resolveParsedTaskStatus(parsed),
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
    return {
      todoItem: params.todoItem,
      task,
      hasPlan: false,
      effectiveStatus: params.todoItem.status,
    };
  }
}

export async function resolveWorkspaceDispatch(params: {
  workspaceDir: string;
  todoPath: string;
  layoutPath: string;
  state: ResearchWorkspaceState;
}): Promise<WorkspaceDispatchResolution> {
  const [todoMarkdown, layoutContent] = await Promise.all([
    fs.readFile(params.todoPath, "utf-8"),
    fs.readFile(params.layoutPath, "utf-8"),
  ]);
  const parsedTodoItems = parseTopLevelTodoMarkdown(todoMarkdown);
  const taskSnapshots = await Promise.all(
    parsedTodoItems.map(
      async (todoItem) =>
        await loadTaskSnapshot({
          workspaceDir: params.workspaceDir,
          layoutContent,
          todoItem,
        }),
    ),
  );
  const todoItems = taskSnapshots.map((snapshot) => ({
    ...snapshot.todoItem,
    status: snapshot.effectiveStatus,
    subtasksDir: snapshot.task.dir.endsWith("/") ? snapshot.task.dir : `${snapshot.task.dir}/`,
  }));

  const unfinishedCodingTasks = taskSnapshots.filter(
    (snapshot) => snapshot.todoItem.workerType === "coding" && snapshot.effectiveStatus !== "done",
  );
  const activeTask = taskSnapshots.find((snapshot) => {
    if (snapshot.effectiveStatus === "done") {
      return false;
    }
    if (snapshot.todoItem.workerType === "writing" && unfinishedCodingTasks.length > 0) {
      return false;
    }
    return true;
  });

  if (!activeTask) {
    return {
      todoItems,
      taskSnapshots,
      completed: true,
      summary: "当前顶层任务已经全部完成。",
    };
  }

  let role = resolveTaskRole(activeTask.task, params.state);
  if (activeTask.todoItem.workerType === "writing" && unfinishedCodingTasks.length > 0) {
    role = "step_planner";
  }

  if (role === "writing_agent") {
    const materialIssue = await validateWritingMaterials({
      workspaceDir: params.workspaceDir,
      task: activeTask.task,
    });
    if (materialIssue) {
      return {
        todoItems,
        taskSnapshots,
        activeTask,
        role: "step_planner",
        completed: false,
        summary: materialIssue,
      };
    }
  }

  if (!activeTask.hasPlan) {
    return {
      todoItems,
      taskSnapshots,
      activeTask,
      role: "step_planner",
      completed: false,
      summary: `${activeTask.task.id} 缺少 plan.md，需要先派 Step Planner。`,
    };
  }
  if (hasMeaningfulBlockers(activeTask.task.blockers)) {
    return {
      todoItems,
      taskSnapshots,
      activeTask,
      role: "step_planner",
      completed: false,
      summary: `${activeTask.task.id} 存在 blocker，需要先重规划。`,
    };
  }

  return {
    todoItems,
    taskSnapshots,
    activeTask,
    role,
    completed: false,
    summary:
      role === "step_planner"
        ? `${activeTask.task.id} 还没有可执行步骤，需要先派 Step Planner。`
        : role === "writing_agent"
          ? `${activeTask.task.id} 已通过 workspace 材料检查，可以进入 Writing。`
          : `${activeTask.task.id} 已有可执行步骤，可以继续 Coding。`,
  };
}
