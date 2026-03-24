import type { ResearchApiModel, ResearchThinkingLevel } from "../commands/research.openai.js";
import {
  renderFallbackLiteratureReviewMarkdown,
  renderIdeaMarkdown,
  renderLayoutMarkdown,
  renderSpecificationMarkdown,
  renderTopLevelTodoMarkdown,
} from "./render.js";
import { ensureTrailingLine } from "./shared.js";
import type {
  ResearchReport,
  ResearchArtifactCollections,
  ResearchSectionExemplars,
  ResearchSection,
  ResearchSectionCitations,
  ResearchTodoItem,
  ResearchWritingStructureSection,
} from "./types.js";

type DryRunResult = {
  report: ResearchReport;
  ideaMarkdown: string;
  specificationMarkdown: string;
  referencesBib: string;
  literatureReviewMarkdown: string;
  todoMarkdown: string;
  layoutMarkdown: string;
};

export function buildDryRunResult(params: {
  idea: string;
  count: number;
  model: ResearchApiModel;
  thinking: ResearchThinkingLevel;
  now: Date;
}): DryRunResult {
  const sections: ResearchSection[] = [
    { id: "S01", name: "introduction" },
    { id: "S02", name: "related-work" },
    { id: "S03", name: "method" },
    { id: "S04", name: "experiments" },
    { id: "S05", name: "conclusion" },
  ];
  const refinedIdea = `Refine "${params.idea}" into a focused research agenda with bounded scope, explicit baselines, and a paper-first execution plan.`;
  const writingStructure: ResearchWritingStructureSection[] = [
    {
      id: "S01",
      name: "introduction",
      writingGoal: "建立研究问题、缺口与贡献，让读者快速理解为什么值得继续读。",
      keyPoints: [
        "交代开放问题背景与实际研究痛点",
        "指出现有方法或流程的关键缺口",
        "给出本文路线与贡献列表",
      ],
      questionsToAnswer: [
        "为什么这个问题值得研究？",
        "本文与现有方法相比新在哪里？",
      ],
      avoidPatterns: ["不要把 introduction 写成 related work 列表。"],
      requiredContext: ["references_bib", "literature_review"],
    },
    {
      id: "S02",
      name: "related-work",
      writingGoal: "按主题组织相邻方向，明确本文相对最近工作的边界。",
      keyPoints: ["按主题归类相关工作", "对比最接近的方法"],
      questionsToAnswer: ["相关工作应如何分组？", "本文与最接近工作差异是什么？"],
      avoidPatterns: ["不要按时间顺序堆论文名。"],
      requiredContext: ["references_bib", "literature_review"],
    },
    {
      id: "S03",
      name: "method",
      writingGoal: "说明方法流程、核心模块与设计理由。",
      keyPoints: ["交代整体流程", "说明关键模块与输入输出"],
      questionsToAnswer: ["方法链路是什么？", "关键设计选择为何成立？"],
      avoidPatterns: ["不要把实验结果写进方法定义。"],
      requiredContext: ["existing_tex"],
    },
    {
      id: "S04",
      name: "experiments",
      writingGoal: "展示实验设置、主结果、对比与分析，并让结论对应证据。",
      keyPoints: ["说明数据与指标", "呈现主结果与消融", "解释关键现象"],
      questionsToAnswer: ["哪些结果支撑核心主张？", "哪些结果需要额外解释？"],
      avoidPatterns: ["不要只贴表格不解释。"],
      requiredContext: ["references_bib", "literature_review", "experiment_results"],
    },
    {
      id: "S05",
      name: "conclusion",
      writingGoal: "收束全文，重申贡献与边界，并自然引出后续工作。",
      keyPoints: ["重申核心结论", "说明局限性与未来方向"],
      questionsToAnswer: ["读者最终应记住什么？"],
      avoidPatterns: ["不要引入正文未论证的新主张。"],
      requiredContext: ["experiment_results"],
    },
  ];

  const referencesBib = ensureTrailingLine(
    [
      "@inproceedings{dryrun1,",
      "  title = {Dry Run Reference 1},",
      "  author = {Author 1 and Coauthor 1},",
      "  year = {2026},",
      "  booktitle = {arXiv},",
      "}",
      "",
      "@inproceedings{dryrun2,",
      "  title = {Dry Run Reference 2},",
      "  author = {Author 2 and Coauthor 2},",
      "  year = {2025},",
      "  booktitle = {ACL Findings},",
      "}",
    ].join("\n"),
  );

  const sectionCitations: ResearchSectionCitations[] = [
    {
      section: "introduction",
      entries: [
        {
          title: "Dry Run Reference 1",
          citationKey: "dryrun1",
          summary: "Dry-run placeholder paper for introduction.",
        },
      ],
    },
    {
      section: "related-work",
      entries: [
        {
          title: "Dry Run Reference 2",
          citationKey: "dryrun2",
          summary: "Dry-run placeholder paper for related-work.",
        },
      ],
    },
  ];
  const literatureReviewMarkdown = renderFallbackLiteratureReviewMarkdown(sectionCitations);
  const sectionExemplars: ResearchSectionExemplars[] = sections.map((section, index) => ({
    section: section.name,
    papers: [
      {
        citationKey: "dryrun1",
        title: `Dry Run Exemplar ${index + 1}A`,
        pdfUrl: "[待核实] arXiv dry run exemplar 1",
        shortIntro: "Short placeholder exemplar for style study.",
        whyRelevant: `Matches the ${section.name} section structure and tone.`,
      },
      {
        citationKey: "dryrun2",
        title: `Dry Run Exemplar ${index + 1}B`,
        pdfUrl: "[待核实] arXiv dry run exemplar 2",
        shortIntro: "Second placeholder exemplar for section writing.",
        whyRelevant: `Provides an alternate ${section.name} writing pattern.`,
      },
    ],
  }));
  const artifactCollections: ResearchArtifactCollections = {
    references: {
      description:
        "待引用文献集合。根级 BibTeX 与按 section 的 citations.md 是同一集合的两种视图，用于正式引用、related work 和实验论证。",
      bibPath: "references.bib",
      sectionMarkdownPattern: "section_materials/<section>/citations.md",
      literatureReviewPath: "literature_review.md",
      citeKeys: ["dryrun1", "dryrun2"],
    },
    exemplars: {
      description: "榜样论文集合。只用于学习写作风格、结构和论证展开方式，不替代正式引用集合。",
      papersDirPattern: "section_materials/<section>/papers/",
      sourceSectionsPattern: "section_materials/<section>/papers/*/source_sections/",
    },
    boundaryNotes: [
      "同一篇论文允许同时出现在 references 与 exemplars，但目录职责与语义仍需区分。",
      "正式引用先走 references.bib 与当前 section 的 citations.md，风格学习走 papers/ 与 source_sections/。",
    ],
  };

  const specification = {
    problem: `Turn the idea into a testable research problem.\n\n${refinedIdea}`,
    scope: "One main question, one feasible implementation path, one bounded evaluation plan.",
    method: [
      "Choose one implementation direction worth validating.",
      "Define the baseline and comparison strategy explicitly.",
      "Keep experiments small enough to iterate quickly.",
    ],
    evaluation: [
      "Choose one main metric and one robustness check.",
      "Define the minimum experiment set needed for a credible result.",
    ],
    risks: [
      "The idea may still be too broad and need manual narrowing.",
      "Dry-run citations are placeholders and must be replaced by live search results.",
    ],
    resources: {
      backbone: {
        name: "UNKNOWN",
        url: "UNKNOWN",
        notes: "Dry-run placeholder. Replace with a real pathology backbone or encoder source.",
      },
      datasets: [
        {
          name: "UNKNOWN",
          url: "UNKNOWN",
          notes: "Dry-run placeholder. Replace with the real dataset entry and acquisition notes.",
        },
      ],
      baselines: [
        {
          name: "UNKNOWN",
          url: "UNKNOWN",
          notes:
            "Dry-run placeholder. Replace with one real baseline implementation or checkpoint source.",
        },
      ],
    },
    execution: {
      environment: [
        "Python environment and package versions should be pinned before running experiments.",
      ],
      entrypoints: [
        {
          path: "src/ or scripts/",
          purpose:
            "Replace with the main training or evaluation entrypoint once the project is initialized.",
        },
      ],
      commands: {
        prepare: ["python prepare_data.py --config configs/data.yaml"],
        train: ["python train.py --config configs/experiment.yaml"],
        evaluate: ["python evaluate.py --checkpoint outputs/best.ckpt"],
      },
      expectedArtifacts: [
        "Prepared dataset metadata or split files",
        "Training logs and checkpoints",
        "Evaluation summary and comparison table",
      ],
    },
  };
  const todo: ResearchTodoItem[] = [
    {
      id: "T01",
      title: "Finalize the exact research question",
      workerType: "coding",
      objective: "Lock the primary question, baseline, and scope boundary.",
      acceptance: [
        "Question statement is fixed",
        "Baseline is named",
        "Out-of-scope items are listed",
      ],
      status: "pending",
      subtasksDir: "tasks/T01/",
    },
    {
      id: "T02",
      title: "Collect and triage literature",
      workerType: "coding",
      objective: "Gather section-specific papers and identify the strongest comparison set.",
      acceptance: ["Core citations collected", "Section notes drafted"],
      status: "pending",
      subtasksDir: "tasks/T02/",
    },
    {
      id: "T03",
      title: "Run the first experiment slice",
      workerType: "coding",
      objective: "Execute the minimum experiment needed to validate signal.",
      acceptance: ["Experiment ran once", "Results are summarized", "Next-step decision recorded"],
      status: "pending",
      subtasksDir: "tasks/T03/",
    },
    {
      id: "T04",
      title: "Harden the implementation path",
      workerType: "coding",
      objective: "Turn the first signal into a reproducible experiment pipeline.",
      acceptance: ["Pipeline is reproducible", "Configs are pinned"],
      status: "pending",
      subtasksDir: "tasks/T04/",
    },
    {
      id: "T05",
      title: "Draft the main manuscript sections",
      workerType: "writing",
      objective: "Write the core paper sections after coding tasks are complete.",
      acceptance: ["Main sections are drafted", "Claims stay aligned with completed experiments"],
      status: "pending",
      subtasksDir: "tasks/T05/",
    },
    {
      id: "T06",
      title: "Polish citations and final LaTeX delivery",
      workerType: "writing",
      objective: "Finalize section order, citations, and LaTeX consistency for submission.",
      acceptance: [
        "References are cited consistently",
        "LaTeX manuscript is ready for final review",
      ],
      status: "pending",
      subtasksDir: "tasks/T06/",
    },
  ];
  const report: ResearchReport = {
    idea: params.idea,
    refinedIdea,
    model: params.model,
    apiModel: params.model.replace(/^openai\//, ""),
    thinking: params.thinking,
    dryRun: true,
    createdAt: params.now.toISOString(),
    stages: [
      { name: "idea", summary: "Generated placeholder refined idea and sections." },
      {
        name: "writing_structure",
        summary: "Generated placeholder section-level writing structure and briefs.",
      },
      { name: "specification", summary: "Generated placeholder specification." },
      { name: "paper", summary: "Generated placeholder references and per-section papers." },
      { name: "todo", summary: "Generated placeholder todo list." },
    ],
    availableTools: [],
    skippedTools: [],
    stageConfigs: [],
    sections,
    writingStructure,
    referencesBib,
    literatureReviewMarkdown,
    sectionCitations,
    sectionExemplars,
    artifactCollections,
    specification,
    todo,
  };
  return {
    report,
    ideaMarkdown: renderIdeaMarkdown({
      seedIdea: params.idea,
      refinedIdea,
      sections,
    }),
    specificationMarkdown: renderSpecificationMarkdown(specification),
    referencesBib,
    literatureReviewMarkdown,
    todoMarkdown: renderTopLevelTodoMarkdown(todo),
    layoutMarkdown: renderLayoutMarkdown(writingStructure),
  };
}
