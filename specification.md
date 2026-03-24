# OpenClaw Research Workflow Specification

## 0. 已冻结的决策

以下决策已经确定，不再反复摇摆：

1. 使用 **单主 OpenClaw session + 多角色 worker** 的架构，不做真正的多 agent 自治系统。
2. 所有 worker 的底层执行方式都是 `exec` 调起 headless Codex。
3. `research run` 只负责生成静态 workspace，并在完成后唤醒主会话。
4. 主会话是调度者，不是执行者。
5. workspace 是唯一真源。
6. **不再使用 `status.json` 作为 task 状态文件。**
7. task 的持久状态以 `plan.md` 为核心，执行结果以 `summary.md`、`outputs/result.json`、`logs/run.log` 为核心。
8. worker 的即时反馈通过 `stdout` 回传，OpenClaw 直接读取 `stdout` / `stderr` / exit code。
9. 下一轮派谁，始终由 OpenClaw 主会话决定，不由当前 worker 自己决定。
10. Writing 必须使用 **LaTeX**，并且必须 **逐 section** 进行。
11. **文献检索结果** 和 **榜样论文** 是两套不同产物，不能混为一谈。
12. Research 阶段必须为每个 section 选出 **两篇榜样论文**。
13. 每篇榜样论文都必须被 **下载、按论文自身的 section 拆分、落盘**，不能只保留题目。
14. Writing 阶段的上下文注入必须是 **逐 section** 的，只注入当前目标 section 对应的 source section Markdown 集合。
15. Research 中 **idea** 与 **writing structure** 是两次独立 API 调用；**writing structure** 以上游 `idea.md` 为上下文，负责生成 `layout.md` 与各 `section_materials/<section>/brief.md`。**`todo.md` 仅基于 idea 与 specification**，不以文献检索或落盘文件为输入。

---

## 1. 目标

基于 OpenClaw 改造一个科研工作流。
输入是一条粗糙 idea。
输出是一个可以持续推进的论文项目目录。

整个系统分两段：

1. **Research 阶段**
   先生成 `idea.md`，再以其为上下文单独生成 **writing structure**：`layout.md` 与各 `section_materials/<section>/brief.md`。此后生成 `specification`、文献检索与引用产物，并按已确定的章节集合为每个 target section 选择两篇榜样论文并按论文自身 section 拆分为 Markdown 文件。**`todo.md` 仅依据 `idea.md` 与 `specification.md` 生成**（不以文献检索产出、落盘文件为输入）。
2. **Execution 阶段**
   唤醒 OpenClaw 主会话。
   主会话读取 workspace，选择一个 next action，派出一个 worker，等待其结束，再进入下一轮调度。**写作任务**仅在 **所有 coding / 实验类顶层任务完成之后** 开始；章节顺序与内容以 **`layout.md`** 为准（见 **§2.9**）。

---

## 2. 总体架构

### 2.1 主会话

OpenClaw 主会话负责：

1. 读取根目录 `AGENTS.md`
2. 读取 `specification.md`
3. 读取顶层 `todo.md`
4. 找到当前未完成的 `tasks/task_xx/`
5. 读取该 task 的 `plan.md`、`summary.md`、`outputs/`、必要日志
6. 在需要写作时，读取目标 section 的 `brief.md` 与本轮选中的 source section Markdown 文件集合
7. 选择本轮唯一 next action
8. 选择对应 worker 类型
9. 通过 `exec` 启动 worker
10. 读取 worker 的 `stdout`、`stderr`、exit code
11. 重新读取 workspace 落盘状态
12. 决定下一轮继续执行、回 Step Planner、派 Writing，或者结束

### 2.2 worker

worker 不是独立长期人格。
worker 的本质是：

```text
headless Codex
+ OpenClaw exec
+ 角色长期规则
+ 本轮任务包
```

worker 的差异只来自 prompt，不来自底层模型或独立 session 身份。

### 2.3 状态真源

task 的状态面分成两层：

1. **即时反馈面**
   - `stdout`
   - `stderr`
   - exit code
2. **持久状态面**
   - `tasks/task_xx/plan.md`
   - `tasks/task_xx/summary.md`
   - `tasks/task_xx/outputs/result.json`
   - `tasks/task_xx/logs/run.log`
   - 必要时的 `tasks/task_xx/history/`

其中：

- `stdout` 只负责回传这一轮的简短结果
- `plan.md` 才是 task 的持久执行状态
- OpenClaw 下一轮调度以 workspace 落盘文件为准
- `stdout` 可以提供提示，但不是长期真源

### 2.4 唤醒方式

Research 完成后，通过 Hook 唤醒主会话一次。
这次唤醒只负责让主会话开始读 workspace，不负责把复杂任务文本塞进 wake payload。

### 2.5 串行约束

严格串行：

1. 同一时刻只允许一个执行型 worker 工作
2. 不允许多个 worker 同时修改同一个 workspace
3. 主会话每轮只选择一个 next action

### 2.6 长期规则位置

- 根目录 `AGENTS.md` 放长期调度规则
- `agents/` 下的角色文件只作为 worker 模板，不依赖自动注入
- 项目细节放 `specification.md`
- **落盘**约定（章节集合、slug、路径映射与固定写作顺序）放 `layout.md`（亦可用 `落盘.md` 等项目约定文件名；见 **§2.9**）
- task 细化状态放 `plan.md`
- section 级写作职责与注入材料放 `section_materials/<section>/`

### 2.7 待引用论文与榜样论文的边界

Research 阶段除 **idea**、**writing structure**、**规格说明**、**待办** 外，还产出 **待引用论文** 与 **榜样论文**；其中各产物之间的依赖关系见 **§2.8**（待办仅由 idea 与规格说明决定，见该节）。

**待引用论文**（用于正式引用、相关工作、实验对比、论证依据）以两种形式并存，可与同一轮检索同源，但与榜样论文在落盘与语义上须区分；指向同一套文献集合的不同载体：

1. **Bib 形式**：集中维护可 `\cite` 的 BibTeX 条目（如根目录 `references.bib`），便于与 LaTeX 写作对接。
2. **Markdown 形式**：**每个 section 对应一个** Markdown 文件，放在 `section_materials/<section>/` 下（**子文件夹名即 section 名**；文件名由项目约定）。该文件按篇列出本 section 可能用到的文献，每一篇至少包含：**最小引用信息**（与 `references.bib` 中条目可对应，如 cite key）、**论文名称**，以及 **一句话最小简介**（仅用于快速回忆这篇是什么、是否该引），目的是写作时便于选用与核对引用；与 `papers/` 下的榜样论文材料分开放置、语义不混用。

**榜样论文** 用于学习写作风格、section 结构、论证展开方式，主要落在 `section_materials/<section>/papers/`。

规则：

1. 待引用论文与榜样论文用途不同，不能合并成一个概念。
2. 待引用论文的 Bib 与 Markdown 是同一集合的两种视图，须保持可对照（新增/修订文献时尽量同步更新两类载体）。
3. 一篇论文允许同时出现在待引用集合与榜样集合中，但在两套集合中的语义仍然不同。
4. Writing 默认优先读取榜样论文材料；正式引用与相关工作默认优先读取待引用论文（先 `references.bib`，再对应当前 section 下的 Markdown）。

### 2.8 Research 产出依赖关系

1. **先生成 `idea.md`**  
   第 1 次 API 调用负责 refined idea 与轻量 section 列表；此时只确定章节集合与顺序，不展开每节具体写什么。

2. **再生成 writing structure**  
   第 2 次 API 调用以上游 **`idea.md`** 为上下文，产出：
   - **`layout.md`**：章节集合、顺序、slug、路径映射的真源
   - **`section_materials/<section>/brief.md`**：该节具体写作目标、必须覆盖点、问题边界与额外读取材料

3. **规格说明与文献检索**  
   在 `idea.md` 已确定后，生成：
   - **`specification.md`**（规格说明）
   - **文献检索与引用产物**（如 `references.bib`、各 `section_materials/<section>/citations.md`、`literature_review.md`）
   其中引用与榜样论文的 section 对齐，必须服从 writing structure 已确定的 canonical section 集合。

4. **仅基于 idea 与 specification 的产物**  
   **`todo.md` 只根据 `idea.md` 与 `specification.md` 生成**：不得把文献检索结果或 **`layout.md` / `brief.md`** 当作 `todo.md` 的输入，以便顶层任务列表与「检索是否完成、落盘是否定稿」解耦。

5. **榜样论文与 section 材料**  
   榜样论文的选择、下载与拆分以 **writing structure / `layout.md`** 所确定的 target section 为准（与 `manuscript/sections/`、`section_materials/<section>/` 对齐）。`brief.md` 初稿由 writing structure 阶段生成；待 `papers/` 与 `source_sections/` 落盘后，可回填 source section 映射。

### 2.9 写作顺序、章节真源与实验 / 写作关系

1. **章节真源（写作结构）**  
   全篇**有哪些章节、顺序如何、路径如何映射**，以 **`layout.md`（落盘约定）** 为真源；**各节具体写什么** 以对应的 **`section_materials/<section>/brief.md`** 为真源。二者共同构成 writing structure，且须与投稿模板 `manuscript/sections/*.tex` 及 `section_materials/<section>/` **对齐**。**Step Planner** 生成 `Section Queue` 时 **不得**另行发明、增删或重排章节（相对 `layout.md`），只将已有章节列为队列项并填写路径与验收；Writing Worker 在落到某一节时再读取该节 `brief.md`。

2. **固定写作顺序**  
   正文写作顺序 **固定**为：**abstract → introduction → method → … → 直至 `layout.md` 所列末章结束**（中间章节名称以 `layout.md` 与模板为准，如 related work、experiments、conclusion 等）。`Section Queue` 中 **W1、W2、…** 的先后与此顺序一致；主会话派发 Writing 时亦按此顺序推进。

3. **实验与写作**  
   **所有** 标注为 **`coding`** 的顶层任务（实验与代码相关）**完成后**，再进入 **`writing`** 任务。写作阶段 **不存在**「本节仍依赖未跑完的实验」：进入写作时假定实验已全部结束。写作 **节与节之间** 不再按实验依赖排序，**仅**按第 2 款的固定章节顺序。

4. **榜样论文数量**  
   Research 阶段为 **每个** target section **恰好生成两篇**榜样论文（落盘为 `papers/paper_01/`、`papers/paper_02/`）。Step Planner 在 `style_sources` 中 **直接引用** 该两篇已落盘文件，**不再**从多篇候选中另选。

### 2.10 Research 提示词模板：writing structure（基于 `idea.md`）

本小节为 **writing structure** 阶段的**默认**提示词。它是**独立于 idea 的第二次 API 调用**，输入为上游 `idea.md`（或等价的 refined idea + section 列表上下文），输出用于落盘：

- 根级 **`layout.md`**
- 各 `section_materials/<section>/brief.md`

它的目标不是再发明研究方向，而是把已确定的 idea 变成**逐 section 可执行的写作合同**。

**占位符**

| 占位符            | 含义                                                           |
| ----------------- | -------------------------------------------------------------- |
| `{{IDEA_MD}}`     | 完整 `idea.md` 正文                                            |
| `{{SECTIONS}}`    | idea 阶段已确定的 section 列表（含 id 与 canonical slug/name） |

**System（建议）**

```text
你是 research pipeline 的 writing structure 生成器。你必须基于已有 idea.md，把论文章节结构扩展成 section-level writing briefs。不得改动上游已确定的 section 数量、顺序、id、name。
```

**User（建议）**

```text
现在请你基于已有的 refined idea 与 section 列表，为每个 section 生成写作结构。你的输出会被落盘为：

1. `layout.md`
   - 记录 canonical section 顺序、slug、materials 路径、manuscript 路径。

2. `section_materials/<section>/brief.md`
   - 记录该 section 的写作目标、必须覆盖点、要回答的问题、应避免的写法，以及需要额外注入的上下文。

要求：

- 不得新增、删除、改名、合并、拆分或重排 section。
- 每个 section 至少给出：
  - `id`
  - `name`
  - `writingGoal`
  - `keyPoints`
  - `questionsToAnswer`
  - `avoidPatterns`
  - `requiredContext`
- `requiredContext` 只能从 `references_bib`、`literature_review`、`experiment_results`、`existing_tex` 中选择。
- `layout.md` 负责章节顺序与路径真源；`brief.md` 负责“这一节到底要写什么”。
```

**实现注意**

1. 这是 **idea 之后、specification / paper / todo 之前** 的独立阶段。
2. `layout.md` 与 `brief.md` 应由同一次 writing structure 输出共同决定，避免二者漂移。
3. 后续 Writing Worker 逐 section 写作时，必须读取当前 section 的 `brief.md`。

### 2.11 Research 提示词模板：文献检索与榜样论文（基于 `idea.md`）

本小节为 **文献检索与引用产物** 阶段的**默认**提示词，用于：基于 **`idea.md`** 从互联网检索写作所需文献，落盘 **`references.bib`**、**各 section 的 Markdown 引用文件**，并给出 **每 section 两篇榜样论文** 及**后续下载逻辑**。实现上可将联网检索结果注入上下文后再调用 LLM 整理。待引用与榜样论文的语义边界见 **§2.7**。

**占位符**

| 占位符              | 含义                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `{{IDEA_MD}}`       | 完整 `idea.md` 正文                                          |
| `{{SECTION_SLUGS}}` | canonical section 列表（英文 slug，如 abstract, introduction, …），来自 writing structure / `layout.md` |

**System（建议）**

```text
你是学术文献检索与整理助手。你必须基于给定的 idea.md，结合互联网检索结果，产出可写入仓库的 BibTeX、按 section 分文件的引用 Markdown，以及每 section 两篇榜样论文的元数据与下载说明。不得编造不存在的 DOI、arXiv 号或下载链接；无法确认时标注 [待核实] 并给出检索关键词。
```

**User（建议）**

```text
现在你需要基于 idea markdown 来从互联网上为我检索对应的文献。这些文献应用于论文写作。

你要为我完成以下输出（由实现将模型输出**后处理**后落盘）：

1. **一个 BibTeX 文件**（根目录 `references.bib`）
   - 包含**所有**将在论文中使用的引用条目；每条须可检索、字段完整，便于 LaTeX `\cite{}`。

2. **按 section 给出适当引用**
   - 针对 `{{SECTION_SLUGS}}` 中的每个 section，列出**适合在该节引用**的文献子集。
   - **每一条**引用须包含三项：**最小引用方式**（与 `references.bib` 中条目一致的 **cite key** 或等价写法）、**论文名称**、**一句话简介**（说明该文献与本节写作的关系）。

3. **落盘拆分**
   - **自行处理**模型输出：汇总为**唯一**的 `references.bib`；
   - 将**各 section 的引用列表**分别写入**对应路径下的 Markdown 文件**（建议 `section_materials/<section>/citations.md`，文件名可由项目约定），即**每个 section 一个 Markdown 文件**，内容与该节引用一一对应。

4. **两篇榜样论文及下载逻辑**
   - 对每个 section，**额外**给出 **两篇榜样论文** 的**完整题名**（并附作者、年份、venue 等便于唯一定位的信息）。
   - **榜样论文**用于学习写作风格与结构，与待引用列表**区分**（见 §2.7）；同一篇可同时出现在两类中，但须注明角色。
   - 明确**后续下载逻辑**：例如优先 **arXiv 开放获取**、官方 **PDF**、**DOI** 落地页等；**不要**编造无法验证的 URL；无法确定时写 `[待核实]` 与建议检索式。

**输出格式提示**：可先输出 BibTeX 代码块，再按 section 输出 Markdown 小节，便于脚本拆分到各 `section_materials/<section>/`。
```

**实现注意**

1. 联网检索可由 **research run** 前置步骤完成，再将摘要注入 `{{RETRIEVAL_CONTEXT}}`（若扩展本模板）或拼入 User。
2. **阶段 ④** 根据榜样元数据执行 PDF 下载与 `papers/paper_01`、`paper_02` 落盘（见 §6）。
3. section slug、目录名与文件名必须服从 **`layout.md`**；文献检索阶段不得自行发明新 section。

### 2.12 Research 提示词模板：`todo.md`（基于 `idea.md` + `specification.md`）

本小节为 **`todo.md` 生成**（**§2.8** 中在 `idea.md` 与 `specification.md` 已存在之后的那次调用）的**默认**提示词。输入为 **`idea.md`** 与 **`specification.md`** 全文；**不得**以文献检索或 `layout.md` 为输入（与 **§2.8** 一致）。

**占位符**

| 占位符                 | 含义                    |
| ---------------------- | ----------------------- |
| `{{IDEA_MD}}`          | 完整 `idea.md`          |
| `{{SPECIFICATION_MD}}` | 完整 `specification.md` |

**System（建议）**

```text
你是科研项目任务拆解助手。根据 idea 与 specification 生成顶层 todo.md：条目粗粒度、可映射到后续 tasks/task_xx。不要生成过细的子步骤（留给各 task 的 plan.md）。输出 Markdown，仅正文。
```

**User（建议）**

```text
现在你要基于 **Idea** 以及 **Specification**，来为我生成一份 **To Do**（顶层 `todo.md`）。

要求：

1. **输入材料**（全文如下，请通读后再写 To Do）
   - **Idea**
   {{IDEA_MD}}
   - **Specification**
   {{SPECIFICATION_MD}}

2. **粒度**：To Do **不应过于细致**；只列**项目级大项**（对应后续 `tasks/task_xx/` 的粗粒度目标），**不要**把 specification 里的每一步命令拆成单独一条。

3. **条数**：**6～10 项**（含 coding 与 writing 两类大项）。

4. **worker 类型**：每一项必须标注 **`coding`** 或 **`writing`**（见 §5.5）；**coding 项在前、writing 项在后**。
```

**实现注意**

1. 调用本提示词前须已存在 **`idea.md`** 与 **`specification.md`**。
2. 若 `specification.md` 尚未落盘，不得空跑本模板。

---

## 3. 角色定义

### 3.1 Research Module

Research Module 是前置模块，不属于主调度循环。

在 **Research 运行之前**，用户将**拟投递论文的 LaTeX 模板**（官方投稿包）放入 workspace（通常包含 `manuscript/` 下的 `main.tex`、`sections/` 等骨架）；该模板由用户按目标期刊或会议准备，**不由 Research Module 生成**。模板来源的**现阶段与规划**见 **§5.15**。

它负责生成（**产出依赖**见 §2.8；**writing structure 默认提示词**见 **§2.10**；文献检索与榜样论文的**默认提示词**见 **§2.11**；**`todo.md` 默认提示词**见 **§2.12**）：

- `idea.md`
- `layout.md` 与各 `section_materials/<section>/brief.md`（由 writing structure 阶段生成）
- `specification.md`
- 文献检索与引用相关产物（`references.bib`、各 `section_materials/<section>/` 下待引用 Markdown、`literature_review.md` 若仍作为独立综述文件使用）
- **仅基于 `idea.md` 与 `specification.md`**：`todo.md`（见 **§2.12**）
- **在 writing structure 已定 section 的前提下**：`section_materials/` 下的榜样论文材料（每篇 `source.pdf`、`meta.md`、`source_sections/*.md`）

其中：

- `layout.md` 与各节 `brief.md` 属于 writing structure 结果
- `references.bib`、`literature_review.md` 与各 section 待引用 Markdown 属于文献检索结果
- `todo.md` **不得**以文献检索产出或落盘文件为输入
- `section_materials/` 属于榜样论文材料；其 target section 以**落盘约定**为准
- `section_materials/` 下必须包含每篇榜样论文的 `source.pdf`、`meta.md` 和按论文自身 section 拆出的 `source_sections/*.md`

### 3.2 OpenClaw 主会话

职责：

1. 读状态
2. 选 task
3. 选 worker
4. 发任务包
5. 接收 `stdout`
6. 重读 workspace
7. 决定下一轮

### 3.3 Step Planner Worker

职责：

1. 首次为某个 task 生成 `plan.md`
2. 当执行路径失效时，重写 `plan.md`，且须**最小改动**：只修订失效步骤与必要的连带依赖，其余可保留则保留，避免无必要整份推倒重来
3. 归档旧计划到 `history/`
4. 只在当前 task 范围内规划，不越级改全局结构
5. 对 Writing task 生成 `Section Queue`：**章节集合与顺序须与 `layout.md` 一致**（见 **§2.9**）；`style_sources` 须指向 Research 已为各 section 落盘的 **`paper_01` 与 `paper_02` 两篇**榜样材料，不另选文献

Step Planner 的核心产物是：

- `tasks/task_xx/plan.md`

### 3.4 Coding Worker

职责：

1. 写代码
2. 改代码
3. 跑短测试
4. 做短时验证
5. 必要时为长任务准备启动脚本和配置
6. 结束后更新当前 task 的 `plan.md`
7. 写 `summary.md`
8. 写 `outputs/result.json`
9. 追加 `logs/run.log`
10. 通过 `stdout` 返回本轮简短结果

### 3.5 Writing Worker

职责：

1. 使用 **LaTeX** 写作
2. 按 **section** 写作，而不是一次写整篇
3. 读取自己角色目录下的 `agents/writing/AGENTS.md`
4. 读取秘书显式注入的 section 任务包
5. 读取对应 section 的 `brief.md` 和本轮选中的 source section Markdown 文件集合
6. 需要时再读取实验结果、`literature_review.md`、`references.bib`、已有文本
7. 只产出当前 section 对应的 `.tex` 文件
8. 不依赖会话记忆
9. 必要时更新当前 task 的 `plan.md`
10. 通过 `stdout` 返回本轮简短结果

---

## 4. workspace 结构

下列树形结构在 **§3.1**、**§2.7–§2.8**、**§2.10–§2.12**、**§13** 等处有交叉说明。标注含义：**[R]** = Research 阶段典型落盘；**[U]** = 用户在 Research 前自行放入（不由 Research Module 生成）；**[E]** = Execution 阶段随 worker 与调度演进出现；**[可选]** = 依项目或场景可有可无。

```text
workspace/
├── AGENTS.md                         # [E] 主会话长期规则；短文本
├── idea.md                           # [R]
├── specification.md                  # [R]
├── layout.md                         # [R] canonical section 顺序、slug、路径映射真源；亦可用 落盘.md 等项目约定文件名
├── literature_review.md              # [R][可选] 综述脉络；与每节 citations 分工见 §2.7、§5.4
├── references.bib                    # [R] 文献检索：可 \cite 的 BibTeX 全集
├── todo.md                           # [R] 仅由 idea + specification 生成（§2.8、§5.5）
├── section_materials/                # [R] 目录名与 layout 中 section slug 对齐
│   ├── <section_slug>/               # 例：abstract、introduction、method、…（以 layout.md 为准）
│   │   ├── citations.md              # [R] 该节待引用列表（文件名可项目约定；§2.11 建议名）
│   │   ├── brief.md                  # [R][E] 该节写作合同；由 writing structure 生成初稿，后续可协同演进
│   │   └── papers/                   # [R] 榜样论文（与 citations 语义分离；§2.7）
│   │       ├── paper_01/
│   │       │   ├── meta.md
│   │       │   ├── source.pdf
│   │       │   └── source_sections/  # 按论文自身结构拆分的 Markdown
│   │       │       ├── 01_abstract.md
│   │       │       ├── 02_introduction.md
│   │       │       └── ...
│   │       └── paper_02/
│   │           ├── meta.md
│   │           ├── source.pdf
│   │           └── source_sections/
│   └── <other_section_slugs>/        # 与 layout 一致，结构同上
├── manuscript/                       # [U] 投稿 LaTeX 模板骨架（§3.1、§5.15）
│   ├── main.tex
│   └── sections/
│       ├── <section>.tex             # Writing 逐节产出或覆盖
│       └── ...
├── tasks/                            # [E] 顶层 todo 映射 task_xx（§5.5）
│   ├── task_01/
│   │   ├── summary.md                # [E]
│   │   ├── logs/
│   │   │   └── run.log               # [E]
│   │   ├── code/                     # [E]
│   │   ├── outputs/
│   │   │   └── result.json           # [E]
│   │   ├── history/                  # [E] 如 plan 归档
│   │   ├── plan.md                   # [E] Step Planner 首次生成；非 task 初始化默认创建
│   │   ├── launch.sh                 # [E][长任务] OpenClaw 发起，交 systemd（§13）
│   │   ├── monitor.sh                # [E][长任务][可选] 结束后 wake（§13）
│   │   └── job.json                  # [E][长任务] unit 名、状态等
│   ├── task_02/
│   └── ...
├── agents/                           # [E] worker 角色模板；须由会话/派发逻辑显式读取，不默认自动注入
│   ├── coding/
│   │   └── AGENTS.md
│   ├── writing/
│   │   └── AGENTS.md                 # Writing Worker 须读（§3.5、§9.4、§10.3）
│   └── step_planner/
│       └── AGENTS.md
└── runtime/
    ├── dispatch_log.md               # [E]
    └── session_notes.md              # [E]
```

说明：

1. `plan.md` 不在 task 初始化时创建，由 Step Planner 首次生成（见上文树中标注）。
2. `agents/*/AGENTS.md` 是角色模板文件，**不是**假设会被 OpenClaw 自动注入；派 Writing 时须显式注入 `agents/writing/AGENTS.md` 等（§9.4）。
3. `section_materials/` 主要由 Research 阶段生成；其中 **待引用**（`citations.md` 等 + 根目录 `references.bib`）与 **`papers/` 榜样材料** 职责分离（§2.7）。
4. `manuscript/`：投稿模板由用户前置，**不由 Research Module 生成**（§3.1）；`sections/*.tex` 为逐节 LaTeX 输出位置。
5. `tasks/`、`runtime/` 随 Execution 演进；长任务相关 `launch.sh`、`job.json`、可选 `monitor.sh` 只在长任务场景出现（§13）。
6. 树中 `<section_slug>`、`<other_section_slugs>` 须与 **`layout.md`** 一致；**不得**与规范中示例章节名强行一致（示例仅作结构说明）。

---

## 5. 关键文件职责

### 5.1 `AGENTS.md`

只放长期规则，并且必须短。

建议只包含：

1. workspace 是真源
2. 每轮只选一个 next action
3. 调度必须串行
4. Coding 失败先回 Step Planner
5. Writing 总是按 section 派发
6. 派 Writing 时必须显式注入 section 材料和任务包
7. 主会话先读 `todo.md`，再读当前 task 的 `plan.md`

### 5.2 `specification.md`

项目详细规范。
供主会话和 worker 显式读取。
不是每轮自动注入的大段常驻 prompt。

### 5.3 `references.bib`

这是文献检索结果的一部分。

它的职责是：

1. 保存论文写作实际可引用的 BibTeX 条目
2. 供 Writing Worker 在 LaTeX 中使用 `\cite{}`
3. 不负责承载榜样论文 section 拆分结果

### 5.4 `literature_review.md`

这是文献检索结果的另一部分。

它的职责是：

1. 总结检索到的相关文献与研究脉络
2. 服务于 related work、实验对比、引用选择
3. 不替代榜样论文材料

### 5.5 `todo.md`

项目级粗粒度任务列表。

由 Research 生成时**仅**以 `idea.md` 与 `specification.md` 为输入，不以文献检索产出或落盘文件（如 `layout.md`、`brief.md`）为输入（见 §2.8）。**默认提示词**见 **§2.12**。

要求：

1. 只保留 **6 到 10** 个大项
2. 每个大项映射到一个 `tasks/task_xx/`；**建议**将所有 **`coding`** 大项排在 **`writing`** 大项之前，以符合「实验全部完成后再写作」（**§2.9**）
3. **每个大项必须显式标明 worker 类型**：**`coding`** 或 **`writing`**（二选一；顶层待办以这两类为主）。可在标题行用标签写出，或用固定字段（如 `worker_type: coding`），**禁止**仅靠标题措辞让主会话猜类型
4. Writing 在顶层 `todo.md` 里必须是带 **`writing`** 标记的显式 task，不靠关键词猜
5. 不承担细粒度执行记录
6. 不承担逐轮调度状态

推荐形态示例：

```markdown
# Todo

- [ ] task_01 — **coding** — 搭建环境与基线脚本
- [ ] task_02 — **coding** — 主实验与长任务评测
- [ ] task_06 — **writing** — 按 section 完成 LaTeX（与 Section Queue 对应）
```

### 5.6 `tasks/task_xx/plan.md`

`plan.md` 是 task 的核心状态文件。

它负责表达：

1. 当前 task 的细化步骤
2. 哪些步骤已完成
3. 哪些步骤阻塞
4. 当前 task 的最近一次执行结果
5. 对下一轮调度的建议

Writing task 的 `plan.md` 必须使用 **Section Queue**，而不是普通 Step List；队列须与 **`layout.md`** 章节及 **§2.9** 固定顺序一致。

### 5.7 worker `stdout`

这是本轮即时反馈面。

OpenClaw 不需要额外包装才能拿到 worker 结果。
`exec` 本来就可以直接得到：

- `stdout`
- `stderr`
- exit code

因此：

1. worker 必须输出简短 `stdout`
2. 不保存超长 JSONL 作为标准反馈
3. `stdout` 只做这轮摘要，不替代 `plan.md`

### 5.8 `tasks/task_xx/summary.md`

这是 task 的阶段总结。

要求至少包含：

1. 本轮做了什么
2. 是否成功
3. 最关键的结果
4. 若失败，失败原因是什么

### 5.9 `tasks/task_xx/outputs/result.json`

这是 task 的机器可读结果文件。

要求至少包含：

- `task_id`
- `success`
- `command`
- `metrics`
- `output_paths`

### 5.10 `tasks/task_xx/logs/run.log`

保存原始执行日志。
供排错、复盘、Writing Worker 按需读取。

### 5.11 `section_materials/<section>/brief.md`

这是某个 section 的写作简介文件。

至少包含：

1. `section_id`
2. `section_title`
3. `writing_goal`
4. 本节**必须覆盖**的关键点列表（如 `Must Cover` / `keyPoints`）
5. 该 section 应该回答什么问题
6. 本 section 应避免写什么
7. 该 section 的 LaTeX 输出路径
8. 本 section 对应的榜样论文 source section 文件路径列表
9. 如需要，额外要读取的引用、综述、实验结果或已有 `.tex`

说明：

- 这里记录的是 section-level writing contract，不是轻量目录索引
- `brief.md` 初稿由 writing structure 阶段生成，后续可在不改变章节集合的前提下细化
- 这里记录的是榜样论文注入映射与额外读取材料
- 不是文献检索结果目录

### 5.12 `section_materials/<section>/papers/paper_xx/meta.md`

这是单篇榜样论文的元信息文件。

至少包含：

1. `citation_key`
2. `title`
3. `pdf_url`
4. `short_intro`
5. `why_relevant`

约束：

- `short_intro` 必须是一句话
- `short_intro` 必须短
- 不允许长段落摘要
- `why_relevant` 应说明这篇论文为什么适合作为该 section 的榜样论文，而不是为什么应该被引用

### 5.13 `section_materials/<section>/papers/paper_xx/source.pdf`

这是下载后的原始 PDF。
后续拆分、重建上下文都以它为源。

### 5.14 `section_materials/<section>/papers/paper_xx/source_sections/*.md`

这是从 PDF 中按论文自身 section 拆出的 Markdown 文件。

每个 section Markdown 至少包含：

1. `paper_title`
2. `citation_key`
3. `section_title`
4. `section_slug`
5. 该 section 的 Markdown 正文

约束：

- 优先按论文自身的 section heading 拆分
- 一篇论文的每个 section 都单独落一个 Markdown 文件
- 尽量保留该 section 的完整内容，而不是只保留零碎摘录
- 如果 PDF 结构较差，允许用启发式规则恢复 section 边界后再落盘

### 5.15 `manuscript/main.tex`

**投稿模板来源（现阶段与规划）**

- **现阶段**：用户从目标期刊或会议**下载官方投稿论文包（模板）**，自行解压并放入 workspace，使 `manuscript/` 存在（通常含 `main.tex` 与 `sections/` 等）；本仓库与 Research **不生成**该包。
- **规划**：将把「提供投稿模板」纳入 **OpenClaw 安装阶段**，要求用户在安装时指定路径或上传模板；语义与现阶段「手动放入 workspace」一致，仍**不由 Research Module 生成**。

这是整篇论文的 LaTeX 主文件。

它负责：

1. 声明文档类、宏包、参考文献入口
2. `\input{sections/...}` 引入各个 section

### 5.16 `manuscript/sections/<section>.tex`

各节 `.tex` 来自同一套投稿模板包中的占位或空壳文件；Writing Worker 在其上逐节写作或覆盖。模板来源见 **§5.15**。

这是逐 section 的 LaTeX 输出文件。

要求：

1. 一个 section 对应一个 `.tex` 文件
2. Writing Worker 每轮只写一个 section
3. 使用 `\cite{...}` 引用，不要手写伪引用

---

## 6. 两篇榜样论文的下载与拆分

这一节只讨论榜样论文。
它不等同于文献检索结果。

### 6.1 选择规则

Research 阶段必须为 **每个** target section **恰好选定两篇**榜样论文，并落盘为 **`papers/paper_01/`** 与 **`papers/paper_02/`**（共两篇，**不是**在多篇候选中留给 Step Planner 再选）。

选择标准（用于 Research 在检索结果中定这两篇）：

1. 与该 section 的写作目标直接相关
2. 能作为结构、写作风格或论证展开方式的参考
3. 能为该 section 提供合适的组织方式和表达范式
4. 主要用途是指导写作风格与 section 组织，而不是充当引用库

### 6.2 下载规则

每篇论文必须：

1. 下载原始 PDF
2. 落盘到对应 section 的 `papers/paper_xx/source.pdf`
3. 在 `meta.md` 中记录标题、citation key、短简介

### 6.3 拆分规则

下载后必须执行拆分。

推荐顺序：

1. 先提取 PDF 文本
2. 识别论文自身的 section heading
3. 按论文自身 section 拆分正文
4. 将每个 section 落盘到 `source_sections/*.md`
5. 如果 heading 识别不稳定，则用启发式规则恢复 section 边界后再落盘

### 6.4 写作注入规则

Research 阶段拆分后，必须保留可直接注入写作的 section Markdown 文件。

写作时的规则：

1. Writing Worker 只注入当前目标 section 对应的 source section Markdown 文件集合
2. 不注入整篇论文
3. 不额外生成 `inject.md`
4. 注入文件必须带着 `citation_key` 可追溯
5. 引用条目仍以 `references.bib` 为准，不以榜样论文目录替代

---

## 7. `plan.md` 模板

### 7.1 普通任务模板

```markdown
# Task Plan

## Task

- task_id: task_01
- title: implement baseline
- done_when: all required steps are checked and blockers are empty

## Step List

- [ ] S1 Setup environment
  - goal: make the pipeline runnable
  - deliverable: runnable command and env file
  - acceptance: one dry-run passes

## Blockers

- none

## 最近执行结果

- 最近结果：尚未执行

## Next Action Hint

- 建议下一轮：coding
```

### 7.2 Writing 任务模板

```markdown
# Task Plan

## Task

- task_id: task_06
- title: section-wise latex writing
- worker_hint: writing
- done_when: all target sections are written as latex files

## Section Queue

（顺序须与 **`layout.md`** 一致，且全篇固定为 **abstract → introduction → method → … → 末章**；下列仅为示例。）

- [ ] W1 abstract
  - materials: section_materials/abstract/
  - style_sources:
    - section_materials/abstract/papers/paper_01/source_sections/01_abstract.md
    - section_materials/abstract/papers/paper_02/source_sections/01_abstract.md
  - output: manuscript/sections/abstract.tex
  - acceptance: abstract saved as LaTeX and cites valid keys

- [ ] W2 introduction
  - materials: section_materials/introduction/
  - style_sources:
    - section_materials/introduction/papers/paper_01/source_sections/02_introduction.md
    - section_materials/introduction/papers/paper_02/source_sections/03_background.md
  - output: manuscript/sections/introduction.tex
  - acceptance: introduction section saved as LaTeX and cites valid keys

- [ ] W3 method
  - materials: section_materials/method/
  - style_sources:
    - section_materials/method/papers/paper_01/source_sections/03_method.md
    - section_materials/method/papers/paper_02/source_sections/04_method.md
  - output: manuscript/sections/method.tex
  - acceptance: method section saved as LaTeX and cites valid keys

## Blockers

- none

## 最近执行结果

- 最近结果：尚未开始写作

## Next Action Hint

- 建议下一轮：writing
```

约束：

1. Writing 任务必须使用 `Section Queue`
2. 一个 queue item 只对应一个 section
3. 一个 queue item 只对应一个 `.tex` 输出文件
4. **章节集合与顺序**须与 **`layout.md`** 一致；**固定顺序**为 **abstract → introduction → method → … → 末章**（见 **§2.9**），Step Planner **不得**擅自增删或重排章节
5. **`style_sources`** 仅引用 Research 已为该 section 落盘的 **`paper_01` 与 `paper_02`** 两篇下的 `source_sections/*.md`，**不再**从其他候选中挑选

---

## 8. worker `stdout` 合同

worker 的 `stdout` 应该短、小、可扫描。

推荐最小格式：

```text
RESULT: done | blocked | failed
SUMMARY: 一句中文简报
PLAN_UPDATE: 勾掉了哪个 step / 写入了哪个 blocker / 是否重写了计划
NEXT_HINT: coding | step_planner | writing | none
```

约束：

1. 允许少量固定行，不要输出超长过程 JSONL
2. `SUMMARY` 必须是一句中文
3. `NEXT_HINT` 只是建议，不拥有调度权
4. OpenClaw 仍然要在 worker 结束后重读 `plan.md`

---

## 9. 调度规则

主会话每轮只做一件事：
**选择一个 next action。**

### 9.1 先看 `todo.md`

找出当前未完成的大项，并确认该项标注的 **`coding` / `writing`**，以便与将派发的 worker 类型一致（见 **§5.5**）。**凡仍有未完成的 `coding` 项，不得开始 `writing` 项**（见 **§2.9**）；`todo.md` 建议将 **coding 大项排在前面、writing 大项排在后面**。

### 9.2 再看当前 task

检查：

- 是否存在 `plan.md`
- `plan.md` 里是否有可执行未完成步骤
- `plan.md` 里是否存在 blocker
- `summary.md`
- `outputs/result.json`
- 必要日志

### 9.3 派发规则

1. 没有 `plan.md`
   - 派 Step Planner
2. `plan.md` 存在，但没有可执行步骤，或明确写了 blocker
   - 派 Step Planner
3. `plan.md` 存在，且有可执行未完成步骤
   - 派 Coding
4. **所有顶层 `coding` 任务已完成**，且当前目标 section 按 **§2.9** 轮到下一节；且 `brief.md` 与 Research 已落盘的 **`paper_01` / `paper_02`** 下所需 `source_sections/*.md` 已完整存在
   - 可以派 Writing
5. 如果本轮 `stdout` 指向失败或阻塞
   - 主会话仍需回读 `plan.md`，确认后通常回 Step Planner

### 9.4 Writing 派发附加规则

派 Writing 时，秘书必须显式注入：

1. `agents/writing/AGENTS.md`
2. 对应 section 的任务包
3. 对应 section 的 `brief.md`
4. 对应 section 的 source section Markdown 文件集合
5. 如果 `brief.md` 声明需要，再注入：
   - `literature_review.md`
   - `summary.md`
   - `outputs/result.json`
   - `references.bib`
   - 已有 `.tex` 文本

### 9.5 决策权边界

worker 不直接派下一个 worker。

worker 只能：

1. 通过 `stdout` 给短回执
2. 通过 `plan.md` 更新当前 task 状态
3. 通过结果文件落盘

真正的派工权始终在 OpenClaw 主会话手里。

---

## 10. worker 输出合同

### 10.1 Step Planner

必须：

1. 生成或重写 `plan.md`；**重写**时须最小改动（同 §3.3 第 2 条）
2. 如发生重规划，先归档旧 `plan.md`
3. 对 Writing task 使用 `Section Queue`
4. 通过 `stdout` 简短说明这轮规划结果

### 10.2 Coding Worker

必须：

1. 更新当前 task 的 `plan.md`
   - 勾掉完成的 step
   - 写 blocker
   - 更新 `最近执行结果`
2. 写 `summary.md`
3. 写 `outputs/result.json`
4. 追加 `logs/run.log`
5. 通过 `stdout` 返回简短结果

### 10.3 Writing Worker

必须：

1. 读取 `agents/writing/AGENTS.md`
2. 读取秘书显式注入的 section 任务包
3. 读取对应 section 的 `brief.md`
4. 读取对应 section 的 source section Markdown 文件集合
5. 如 `brief.md` 声明需要，再读取 `literature_review.md`、`summary.md`、`outputs/result.json`、`references.bib`、已有 `.tex`
6. 只撰写当前 section，不跨 section 发散
7. 使用 LaTeX 写作
8. 输出到 `manuscript/sections/<section>.tex`
9. 必要时更新当前 task 的 `plan.md`
10. 通过 `stdout` 返回简短结果

---

## 11. Hook 固定模板

Hook 使用固定模板。
不在外部动态生成复杂调度 prompt。

### `/hooks/wake` payload（Research 完成）

```json
{
  "text": "Research stage completed. Read AGENTS.md, specification.md, todo.md, and incomplete tasks under tasks/. Select exactly one next action.",
  "mode": "now"
}
```

### `/hooks/wake` payload（长任务 / 实验结束）

由 **监控脚本**在长任务结束后调用；提示主会话：实验已跑完，请基于当前落盘状态做**下一步计划**（仍只选一项 next action）。

```json
{
  "text": "实验已经执行完毕。请读取 AGENTS.md、当前 task 的 plan.md、summary.md、outputs/ 与必要日志，并据此进行下一步计划；本轮只选择恰好一个 next action。",
  "mode": "now"
}
```

---

## 12. 失败回退和计划版本化

失败是标准路径，不是异常路径。

### 12.1 Coding 失败时

必须：

1. 写 `summary.md`
2. 追加 `logs/run.log`
3. 保留已有 `outputs/`
4. 在 `plan.md` 的 `Blockers` 中写明问题
5. 在 `plan.md` 的 `最近执行结果` 中写一句话
6. 通过 `stdout` 明确返回 `failed` 或 `blocked`

### 12.2 Writing 失败时

必须：

1. 保留已有 `.tex` 输出
2. 在 `plan.md` 中写 blocker
3. 在 `最近执行结果` 中写一句话
4. 通过 `stdout` 明确说明失败原因

### 12.3 回退策略

主会话不直接盲目重试。
而是先回 Step Planner。

### 12.4 计划版本化

重规划前，旧计划必须归档到：

- `tasks/task_xx/history/plan.v1.md`
- `tasks/task_xx/history/plan.v2.md`
- ...

当前生效版本始终仍然叫 `plan.md`。

---

## 13. 长任务、systemd 与监控脚本

长任务不应该长期占用单次 worker 会话。

### 13.1 短任务

由 Coding Worker 直接执行。

适用范围：

- 改代码
- 小规模脚本运行
- 单元测试
- 快速 sanity check
- 小数据集 dry-run

### 13.2 长任务（推荐由 systemd 承载）

适用范围：

- 长时间训练
- 大规模评测
- 多小时实验
- 需要后台守护的任务

**执行面**：长任务本体推荐跑在 **systemd** 之下（例如用户级 `systemd --user` 的 unit、或项目约定的 service/timer），由系统负责进程监督、日志与退出码，而不是让单次 Coding Worker 会话一直阻塞在前台。

**发起方**：长任务的启动由 **OpenClaw 侧发起**（例如 Coding Worker 写好 `launch.sh` 后，由主会话按调度执行该脚本，或由同一条自动化链路调用），**不要求**用户在实验中途独占终端手动盯着跑完。

### 13.3 发起 → systemd → 监控脚本 → 唤醒

推荐闭环如下：

1. **Coding Worker**（或等价步骤）在 task 目录准备 **`launch.sh`**：内容包含向 systemd **提交**长作业（例如 `systemctl --user start <unit>`、`systemd-run`、或启动已安装的 unit），并把 **unit 名**、**日志路径**、**job 标识** 等写入 **`job.json`** 初始字段。
2. **OpenClaw** 在合适时机 **执行** `launch.sh`（发起一次），使长任务进入 **systemd** 管理；此后 **Coding Worker 立即返回**，不在会话内等待训练结束。
3. **监控脚本**（独立脚本或小型常驻服务，路径可由项目约定，例如与 `launch.sh` 同目录的 `monitor.sh`，或由 systemd 再拉起 oneshot）：**阻塞等待**该长任务结束（例如轮询 `systemctl is-active`、或等待 unit 进入 `inactive`/`failed` 等约定条件），期间可顺带 tail 日志路径写入 `logs/run.log`（若需要）。
4. 监控脚本在确认**结束后**：
   - 更新 **`job.json`** 终态；
   - 生成或更新 **`summary.md`**、**`outputs/result.json`**；
   - 必要时在 **`plan.md`** 的「最近执行结果」中写一句话；
   - 调用 **`/hooks/wake`**（或项目配置的等价唤醒端点）**唤醒 OpenClaw 主会话**，payload 文案见 **§11.2**。
5. 主会话被唤醒后按常规读 workspace，**选择下一项 next action**（例如回 Step Planner、继续 Coding、或进入 Writing）。

### 13.4 长任务相关文件

若 task 含长任务，目录中可额外出现：

- `tasks/task_xx/launch.sh`（由 Coding Worker 准备；负责把作业交到 systemd）
- `tasks/task_xx/job.json`（记录 unit 名、状态、起止时间等机器可读信息）
- `tasks/task_xx/monitor.sh`（可选；监控脚本；若监控逻辑固定在仓库别处，须在 `job.json` 或 `README` 中写明入口）

其中：`launch.sh` 与监控脚本的**具体实现**可随项目调整，但语义须符合 **§13.3**。

### 13.5 长任务状态位置

长任务如果需要机器可读状态，放在 `job.json`。
不要重新引入 task 级别的 `status.json`。

---

## 14. 测试范围

必须先写测试，再写实现。

### 14.1 Research 阶段

1. 是否生成核心文件
2. `todo.md` 是否只有 6 到 10 个大项
3. `todo.md` 每个大项是否**显式标明** `coding` 或 `writing`（见 §5.5）
4. 是否生成 `section_materials/<section>/`
5. `references.bib` 和 `literature_review.md` 是否作为独立的文献检索产物存在
6. 每个 section 是否**恰好**落盘 **`paper_01` 与 `paper_02` 两篇**榜样论文
7. 每篇论文是否下载了 `source.pdf`
8. 每篇论文是否生成了 `meta.md`
9. `meta.md` 中的简介是否足够短
10. 每篇论文是否按论文自身 section 落成 Markdown
11. 所选 source section Markdown 文件集合是否可被后续写作直接注入

### 14.2 task 初始化

1. 是否创建 task 文件夹
2. 是否创建 `summary.md`、`logs/run.log`、`outputs/result.json`、`history/`、`code/`
3. 初始化后是否**没有** `plan.md`

### 14.3 调度

1. 无 `plan.md` 时是否选 Step Planner
2. 有 `plan.md` 且有可执行步骤时是否选 Coding
3. `plan.md` 存在 blocker 时是否回到 Step Planner
4. 是否仅在 **所有顶层 `coding` 任务完成后**才允许派 Writing；且 `Section Queue` / 派发顺序是否与 **`layout.md`** 及 **§2.9**（abstract → introduction → method → …）一致

### 14.4 输出合同

1. Coding 结束后是否更新 `plan.md`
2. `summary.md` 是否存在
3. `result.json` 是否可解析
4. `stdout` 是否保持短格式
5. 失败时日志和已有结果是否保留

### 14.5 Writing

1. Writing Worker 是否读取自己的 `agents/writing/AGENTS.md`
2. Writing Worker 是否读取 section 任务包
3. Writing Worker 是否读取 `brief.md`
4. Writing Worker 是否读取目标 section 对应的 source section Markdown 文件集合
5. Writing Worker 是否在需要时读取实验结果、`literature_review.md` 和 `references.bib`
6. Writing Worker 是否一次只写一个 section
7. 输出是否写到 `manuscript/sections/<section>.tex`
8. 输出是否为合法的 LaTeX section 文本
9. `plan.md` 中 `Section Queue` 是否与 **`layout.md`** 章节一致且顺序符合 **§2.9**；`style_sources` 是否仅含 **`paper_01`/`paper_02`**

### 14.6 计划版本化

1. 重规划时是否归档旧 `plan.md`
2. 新 `plan.md` 是否替换为当前版本

### 14.7 长任务

1. 长任务是否由 **OpenClaw 发起** `launch.sh` 并进入 **systemd** 管理（而非 worker 会话内长时间阻塞）
2. `launch.sh` / `job.json` 是否可解析；`job.json` 是否记录 unit 名或等价标识
3. **监控脚本**是否在作业结束后更新 `summary.md`、`outputs/result.json`，必要时更新 `plan.md`
4. 结束后是否调用 **`/hooks/wake`**，且 payload 语义与 **§11.2** 一致（实验已结束、请进行下一步计划）

---

## 15. 最小闭环验收标准

给一个粗糙 idea，系统必须能完成：

1. 生成 `idea.md`
2. 基于 `idea.md` 单独生成一次 writing structure，并落盘 `layout.md` 与各 `section_materials/<section>/brief.md`
3. 生成 `specification.md`、文献检索与引用相关产物（含 `references.bib`、各 section 待引用 Markdown、以及 `literature_review.md` 若仍使用）
4. **仅**基于 `idea.md` 与 `specification.md` 生成 `todo.md`（不以文献检索或落盘文件为输入）；**6～10 个大项，每项显式标明 `coding` 或 `writing`**（见 §5.5）
5. 为 writing structure 所定每个 target section 生成 `section_materials/<section>/`
6. 文献检索结果与榜样论文目录在结构上明确分离
7. 为每个 section 选出两篇榜样论文
8. 下载每篇论文的 PDF
9. 为每篇论文生成短简介并按论文自身 section 落成 Markdown
10. 写作时只注入当前目标 section 对应的 `brief.md` 与 source section Markdown 文件集合
10. 用户已在 Research 前提供拟投递论文的 `manuscript/` 投稿模板（现阶段多为手动下载后放入；未来规划见 §5.15；Research 不生成该骨架）
11. 通过 Hook 唤醒主会话
12. 主会话读取状态并选出 next action
13. 先派 Step Planner
14. 再派 Coding
15. 处理一次 Coding 失败
16. 归档旧计划并生成新计划
17. 产出 `summary.md`、`result.json`、`run.log`
18. 让 Writing 按 section 消费材料并写出 `.tex`

---

## 16. 一句话总结

这是一个**以 OpenClaw 为主调度器、以 workspace 为唯一真源、以 `plan.md` 为 task 持久状态核心、以 `stdout` 为本轮即时反馈、以每个 section 的两篇榜样论文 PDF 下载结果和 section Markdown 拆分结果驱动逐 section LaTeX 写作**的串行科研工作流。

---

## 17. 本仓库开发调试与现有代码

本节描述**本仓库（research-god / OpenClaw 相关代码）**在实现规范时的本地约定，**不**改变 §0～§16 中科研工作流本身的语义。

### 17.1 调试凭据：API 密钥与 Codex

- **本地调试**时，若已在本机配置 **OpenAI 兼容 API**（如环境变量 `OPENAI_API_KEY` 等，具体以项目 `.env` / 部署文档为准）以及 **Codex CLI**（`codex` 在 `PATH` 中且可 `codex --version`），**即可**用于脚本与网关调试（含 **PowerShell** 或 **Bash** 下调用同一套环境变量）。
- **安全要求**：**禁止**将真实密钥、密钥片段或 `.env` 内容写入 **本 specification** 或提交到 Git；`.env` 已列入 **`.gitignore`**。本节仅说明「若已配置则可调试」，**不落盘任何凭据**。

### 17.2 现有代码实现与复用

- 本仓库**已包含**部分 **OpenClaw 网关、CLI、渠道**等实现代码，**逻辑可能与**本规范或后续重构**不一致**；**允许**作为起点**复用**，但应**对照** `specification.md` 与 `implementation_todo.md` 做增量修正与测试，**不得**假设现状与规范逐条等价。

### 17.3 调试时的 GPT‑5.4 Thinking

- **调试时**若使用 **GPT‑5.4** 并开启 **Thinking**，请将 **`reasoning.effort` 设为 `low`**（OpenAI Responses API 语义）。
