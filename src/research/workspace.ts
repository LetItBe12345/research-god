import fs from "node:fs/promises";
import path from "node:path";
import { renderSectionBriefMarkdown } from "./render.js";
import { buildExemplarMaterialRecords, buildSectionBrief } from "./section-materials.js";
import { slugify } from "./shared.js";
import {
  RESEARCH_LAYOUT_FILENAME,
  type ResearchExemplarPaper,
  type ResearchSection,
  type ResearchRoleName,
  type ResearchWritingStructureSection,
  type ResearchWorkspacePaths,
} from "./types.js";

const ROLE_DIR_NAMES: Record<ResearchRoleName, string> = {
  step_planner: "step_planner",
  coding_agent: "coding",
  writing_agent: "writing",
};

export function resolveResearchWorkspacePaths(outputDir: string): ResearchWorkspacePaths {
  const agentsDir = path.join(outputDir, "agents");
  const runtimeDir = path.join(outputDir, "runtime");
  const manuscriptDir = path.join(outputDir, "manuscript");
  return {
    outputDir,
    workspaceAgentsPath: path.join(outputDir, "AGENTS.md"),
    ideaPath: path.join(outputDir, "idea.md"),
    specificationPath: path.join(outputDir, "specification.md"),
    layoutPath: path.join(outputDir, RESEARCH_LAYOUT_FILENAME),
    literatureReviewPath: path.join(outputDir, "literature_review.md"),
    referencesPath: path.join(outputDir, "references.bib"),
    todoPath: path.join(outputDir, "todo.md"),
    tasksDir: path.join(outputDir, "tasks"),
    agentsDir,
    sectionMaterialsDir: path.join(outputDir, "section_materials"),
    runtimeDir,
    dispatchLogPath: path.join(runtimeDir, "dispatch_log.md"),
    sessionNotesPath: path.join(runtimeDir, "session_notes.md"),
    manuscriptDir,
    manuscriptMainPath: path.join(manuscriptDir, "main.tex"),
    manuscriptSectionsDir: path.join(manuscriptDir, "sections"),
    statePath: path.join(outputDir, "state.json"),
    roleAgentPaths: {
      step_planner: path.join(agentsDir, ROLE_DIR_NAMES.step_planner, "AGENTS.md"),
      coding_agent: path.join(agentsDir, ROLE_DIR_NAMES.coding_agent, "AGENTS.md"),
      writing_agent: path.join(agentsDir, ROLE_DIR_NAMES.writing_agent, "AGENTS.md"),
    },
  };
}

export type ResearchTaskArtifactPaths = {
  taskDir: string;
  planPath: string;
  summaryPath: string;
  outputsDir: string;
  resultJsonPath: string;
  logsDir: string;
  runLogPath: string;
  launchPath: string;
  monitorPath: string;
  jobPath: string;
};

export function resolveTaskArtifactPaths(
  workspaceDir: string,
  taskDir: string,
): ResearchTaskArtifactPaths {
  const absoluteTaskDir = path.join(workspaceDir, taskDir);
  return {
    taskDir: absoluteTaskDir,
    planPath: path.join(absoluteTaskDir, "plan.md"),
    summaryPath: path.join(absoluteTaskDir, "summary.md"),
    outputsDir: path.join(absoluteTaskDir, "outputs"),
    resultJsonPath: path.join(absoluteTaskDir, "outputs", "result.json"),
    logsDir: path.join(absoluteTaskDir, "logs"),
    runLogPath: path.join(absoluteTaskDir, "logs", "run.log"),
    launchPath: path.join(absoluteTaskDir, "launch.sh"),
    monitorPath: path.join(absoluteTaskDir, "monitor.sh"),
    jobPath: path.join(absoluteTaskDir, "job.json"),
  };
}

async function writeFileIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content, "utf-8");
  }
}

export async function initializeTaskArtifactScaffold(
  workspaceDir: string,
  taskDir: string,
): Promise<ResearchTaskArtifactPaths> {
  const paths = resolveTaskArtifactPaths(workspaceDir, taskDir);
  const taskId = path.basename(taskDir);
  await Promise.all([
    fs.mkdir(paths.taskDir, { recursive: true }),
    fs.mkdir(paths.outputsDir, { recursive: true }),
    fs.mkdir(paths.logsDir, { recursive: true }),
  ]);
  await Promise.all([
    writeFileIfMissing(paths.summaryPath, "# Summary\n\n- 暂无执行结果。\n"),
    writeFileIfMissing(
      paths.resultJsonPath,
      `${JSON.stringify(
        {
          taskId,
          status: "pending",
          summary: "暂无执行结果。",
        },
        null,
        2,
      )}\n`,
    ),
    writeFileIfMissing(paths.runLogPath, ""),
  ]);
  return paths;
}

export async function initializeResearchWorkspace(paths: ResearchWorkspacePaths): Promise<void> {
  await Promise.all([
    fs.mkdir(paths.outputDir, { recursive: true }),
    fs.mkdir(paths.tasksDir, { recursive: true }),
    fs.mkdir(paths.sectionMaterialsDir, { recursive: true }),
    fs.mkdir(path.dirname(paths.roleAgentPaths.step_planner), { recursive: true }),
    fs.mkdir(path.dirname(paths.roleAgentPaths.coding_agent), { recursive: true }),
    fs.mkdir(path.dirname(paths.roleAgentPaths.writing_agent), { recursive: true }),
    fs.mkdir(paths.runtimeDir, { recursive: true }),
  ]);
}

export async function migrateLegacyResearchWorkspace(paths: ResearchWorkspacePaths): Promise<void> {
  const migrations = [
    {
      source: path.join(paths.outputDir, "specification", "idea.md"),
      target: paths.ideaPath,
    },
    {
      source: path.join(paths.outputDir, "specification", "specification.md"),
      target: paths.specificationPath,
    },
    {
      source: path.join(paths.outputDir, "paper", "references.bib"),
      target: paths.referencesPath,
    },
    {
      source: path.join(paths.outputDir, "paper", "literature_review.md"),
      target: paths.literatureReviewPath,
    },
  ];
  await Promise.all(
    migrations.map(async ({ source, target }) => {
      const targetExists = await fs
        .access(target)
        .then(() => true)
        .catch(() => false);
      if (targetExists) {
        return;
      }
      const content = await fs.readFile(source, "utf-8").catch(() => null);
      if (content === null) {
        return;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, "utf-8");
    }),
  );
}

export async function initializeSectionArtifacts(params: {
  paths: ResearchWorkspacePaths;
  sections: ResearchSection[];
  writingStructureBySection: ReadonlyMap<string, ResearchWritingStructureSection>;
  citationsBySection: ReadonlyMap<string, string>;
  exemplarsBySection?: ReadonlyMap<string, readonly ResearchExemplarPaper[]>;
}): Promise<void> {
  await Promise.all(
    params.sections.map(async (section) => {
      const slug = slugify(section.name);
      const sectionDir = path.join(params.paths.sectionMaterialsDir, slug);
      const citationsPath = path.join(sectionDir, "citations.md");
      const briefPath = path.join(sectionDir, "brief.md");
      const papersDir = path.join(sectionDir, "papers");
      await fs.mkdir(papersDir, { recursive: true });
      const exemplarPapers = params.exemplarsBySection?.get(slug);
      const exemplarRecords =
        exemplarPapers === undefined
          ? []
          : buildExemplarMaterialRecords({
              sectionSlug: slug,
              papers: exemplarPapers,
            });
      await Promise.all(
        exemplarRecords.map(async (record) => {
          await fs.mkdir(path.join(params.paths.outputDir, record.dirPath), { recursive: true });
          await fs.writeFile(
            path.join(params.paths.outputDir, record.metaPath),
            record.metaMarkdown,
            "utf-8",
          );
        }),
      );
      await Promise.all([
        fs.writeFile(
          citationsPath,
          params.citationsBySection.get(slug) ?? `# ${slug} 引用候选\n`,
          "utf-8",
        ),
        buildSectionBrief({
          paths: params.paths,
          section:
            params.writingStructureBySection.get(slug) ?? {
              id: section.id,
              name: slug,
              writingGoal: "围绕当前 section 的职责完成论证，并保证内容与 layout.md 的章节边界一致。",
              keyPoints: ["明确本节的主张与边界。"],
              questionsToAnswer: ["这一节最重要的读者问题是什么？"],
              avoidPatterns: ["不要写超出本节职责边界的内容。"],
              requiredContext: [],
            },
        }).then((brief) => fs.writeFile(briefPath, renderSectionBriefMarkdown(brief), "utf-8")),
      ]);
    }),
  );
}

export function resolveRoleWorkspaceDir(workspaceDir: string, role: ResearchRoleName): string {
  return path.join(workspaceDir, "agents", ROLE_DIR_NAMES[role]);
}

export async function validateManuscriptTemplate(params: {
  paths: ResearchWorkspacePaths;
  dryRun: boolean;
}): Promise<{ ok: boolean; warning?: string }> {
  try {
    const stats = await fs.stat(params.paths.manuscriptMainPath);
    if (!stats.isFile()) {
      throw new Error(`${params.paths.manuscriptMainPath} is not a file`);
    }
    return { ok: true };
  } catch (error) {
    const message = [
      "User-provided manuscript template is missing.",
      `Expected file: ${params.paths.manuscriptMainPath}`,
      "Research run will not generate manuscript/ for you.",
    ].join(" ");
    if (params.dryRun) {
      return { ok: false, warning: message };
    }
    throw new Error(message, { cause: error });
  }
}
