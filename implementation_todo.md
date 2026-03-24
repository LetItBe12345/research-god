# OpenClaw Research Workflow Implementation Todo

基于当前 `specification.md` 拆出的详细实现清单（重点：**§2.7–§2.11** 产出依赖与提示词、**§2.9** 章节真源与 coding/writing 顺序、**§3.1** Research 与用户模板边界、**§4** workspace、**§5.5–§5.6** `todo.md` / `plan.md`）。

约束（与 `specification.md` 对齐）：

- 以 workspace 为唯一真源
- `research run` 只负责生成静态 workspace 并在完成后唤醒主会话
- OpenClaw 主会话负责读取 workspace、选择 next action、派发 worker
- 严格串行，不并行跑多个执行型 worker
- task 不再使用 `status.json`
- `stdout` 负责本轮即时反馈
- `plan.md` 负责 task 持久执行状态
- `summary.md`、`outputs/result.json`、`logs/run.log` 负责结果落盘
- Writing 必须使用 LaTeX
- Writing 必须按 section 执行
- **§2.8**：`specification.md`、文献检索与引用产物、`layout.md`（落盘约定）三者 **并行、均只基于 `idea.md`**；**`todo.md` 仅基于 `idea.md` + `specification.md`**，不得以文献检索产出或 `layout.md` 为输入
- **§2.9**：章节真源与顺序以 **`layout.md`** 为准；**所有顶层 `coding` 任务完成后** 再进入 **`writing`**；Step Planner 的 Section Queue **不得**相对 `layout.md` 增删或重排章节
- **§3.1 / §5.15**：**投稿 LaTeX 模板**（通常 `manuscript/main.tex`、`manuscript/sections/*.tex`）由用户在 Research **前**放入 workspace，**不由 Research Module 生成**
- 文献检索结果（`references.bib`、各 section 待引用 Markdown、`literature_review.md` 等）与榜样论文（`section_materials/.../papers/`）必须分开建模（§2.7）
- Research 在落盘约定已定后，为 **每个 target section** 产出 **两篇**榜样论文材料并下载、拆分（§2.9、§6）

---

## T01 对齐 workspace 总目录结构

### 目标

把当前 `research run` 生成的目录结构迁移到新的标准布局；**补齐** `section_materials/`、`layout.md` 等 Research 职责内路径。**不**把「生成投稿用 `manuscript/` 模板」算作 Research 职责（§3.1、§5.15）。

### 代码落点

- `src/commands/research.ts`
- `src/research/workspace.ts`（新增）
- `src/research/types.ts`

### 子任务

- [x] 新增统一的 workspace 初始化器（骨架目录与真源文件占位）
- [x] 创建根目录文件（与 §4、§5 一致）：
  - [x] `AGENTS.md`
  - [x] `idea.md`
  - [x] `specification.md`
  - [x] **`layout.md`**（落盘约定；当前默认落盘为 `layout.md`，别名支持留待后续读取链路接入）
  - [x] `literature_review.md`（当前由文献 Markdown 占位）
  - [x] `references.bib`
  - [x] `todo.md`
- [x] 创建目录：
  - [x] `tasks/`
  - [x] `agents/`
  - [x] `agents/coding/`
  - [x] `agents/writing/`
  - [x] `agents/step_planner/`
  - [x] `section_materials/`
  - [x] `runtime/`
- [x] **`manuscript/`**：**不**由 `research run` 生成官方投稿包；当前实现为“live run 缺模板报错，dry-run 缺模板警告”
- [x] 初始化 runtime 文件：
  - [x] `runtime/dispatch_log.md`
  - [x] `runtime/session_notes.md`
- [x] 废弃旧布局中的目录：
  - [x] `coding_agent/`
  - [x] `writing_agent/`
  - [x] `step_planner/`
  - [x] 旧 `specification/` 和 `paper/` 布局
- [x] 不在 task 初始化阶段创建 `status.json`
- [x] 兼容边界说明：当前保留既有 `tasks/Txx/todo.md` 与根级 `state.json` 调度兼容层；task 内部状态面（`plan.md` / `summary.md` / `outputs/` / `logs/`）的彻底迁移留给后续 T07、T10，避免本任务与后续职责重叠

### 测试

- [x] `research run --dry-run` 后，根目录必须存在核心文件（含 `layout.md`）
- [x] `research run --dry-run` 后，必须存在 `agents/`、`section_materials/`、`runtime/`、`tasks/`
- [x] 若策略为「必须有用户模板」：`manuscript/main.tex` 在 dry-run 下行为符合实现约定（缺失时警告；live run 需预置模板）
- [x] `runtime/dispatch_log.md`、`runtime/session_notes.md` 必须存在
- [x] 不再生成旧版角色目录
- [x] 任何 task 目录下都不应初始化出 `status.json`

### 验收标准

- [x] 新 workspace 顶层结构与 `specification.md` **§4** 对齐（含 `layout.md` 职责、`agents/`、`section_materials/`、`runtime/`；task 内部状态契约迁移见上方兼容边界）
- [x] 用户只看目录，就能识别主会话、worker、section 材料、落盘约定、task、runtime 的职责边界
- [x] **不出现**「Research 生成期刊投稿模板」与规范的冲突
- [x] 不再出现旧路径和新路径混用

---

## T02 对齐 Research 阶段核心产物、文献检索输出和 section 映射

### 目标

让 `research run` 稳定实现 **§2.8** 的产出依赖：**并行** 生成 `specification.md`、文献检索与引用产物、`layout.md`；再 **仅** 用 `idea.md` + `specification.md` 生成 `todo.md`；并在 **落盘约定** 所定 target section 上完成 section 材料目录、slug 对齐与目录职责边界的初始化。  
说明：本任务先把 **榜样论文目录面与 target-section 对齐**、为后续落盘准备好 `papers/` 边界；**每个 section 两篇榜样论文的具体选择、meta 与 PDF 拆分** 仍由 **T04/T05** 承接，避免与后续任务重复实现。

### 代码落点

- `src/commands/research.ts`
- `src/research/render.ts`
- `src/research/parsing.ts`
- `src/research/dry-run.ts`

### 子任务

- [x] 把旧布局迁移（若仍存在）：`specification/idea.md` → 根目录 `idea.md`；`specification/specification.md` → 根目录 `specification.md`；`paper/references.bib` → 根目录 `references.bib` 等
- [x] **并行** 调用链（逻辑上互不以前置为输入，仅共享 `idea.md`）：
  - [x] 生成 **`specification.md`**
  - [x] 生成 **`layout.md`**（target section 列表、`section_materials/<section>/` 与 `manuscript/sections/<section>.tex` 的对应关系等；§2.8-1）
  - [x] 生成文献检索与引用产物：**`references.bib`**、各 **`section_materials/<section>/` 下待引用 Markdown**（实现为 `citations.md`）与 **`literature_review.md`**
- [x] **禁止** 将文献检索结果或 `layout.md` 作为 **`todo.md`** 生成提示词的输入（§2.8-2、§5.5）；**仅** 在 `idea.md` 与 `specification.md` 均已落盘后调用 **§2.11** 模板生成 `todo.md`
- [x] **章节 slug 真源**：以 **`layout.md`** 为准；若 §2.10 输出与 `layout.md` 不一致，**以 `layout.md` 为准**调整路径与文件名（§2.10 实现注意）
- [x] 明确语义边界（§2.7）：**待引用** 落在 `references.bib` + 各 section 下待引用 Markdown；**榜样论文** 落在 `section_materials/<section>/papers/`；二者不得混用目录职责
- [x] 在 **`layout.md`** 已定、slug 已对齐的前提下，为各 section 初始化目录（含 `brief.md`、`citations.md`、`papers/`；`paper_01`/`paper_02` 与下载拆分留待 T04/T05）

### 测试

- [x] Research 阶段输出测试覆盖核心文件是否存在（含 `layout.md`）
- [x] 验证 `todo.md` 生成管线 **未** 读取 `references.bib` / `layout.md` / `section_materials/`（以 mock prompt 断言）
- [x] `todo.md` 中大项数量在 **6～10** 个（§2.11、§5.5）
- [x] `idea.md` 至少包含问题定义、研究目标、核心假设、方法方向、预期贡献
- [x] `references.bib` 必须是可解析的 BibTeX 文本
- [x] `literature_review.md`：若存在则可读；当前实现默认输出可读综述文件
- [x] 待引用 Markdown 与 `papers/` 目录分离测试
- [x] section slug 与 `layout.md` 一致性测试（含「以 layout 为准」覆盖）

### 验收标准

- [x] `research run` 的静态产物与 `specification.md` **§2.8、§3.1** 对齐
- [x] 引用材料和榜样论文材料在目录和语义上明确分离（§2.7）
- [x] 所有 **target section** 在 `layout.md`、`section_materials/` 与用户 `manuscript/sections/` 之间可 **对齐**（不由 Research 伪造模板时，以用户模板 + `layout.md` 为真源）

---

## T03 固化文献检索结果面

### 目标

把文献检索结果固定成独立于榜样论文的产物面，专门服务于引用、related work 和实验论证；与 **§2.7** 一致：**Bib** 与 **按 section 的待引用 Markdown** 为同一文献集合的不同载体。

### 代码落点

- `src/research/pipeline.ts`
- `src/research/parsing.ts`
- `src/research/render.ts`
- `src/research/types.ts`
- `src/commands/research.ts`

### 子任务

- [x] 定义文献检索结果与榜样论文的边界（§2.7）
- [x] 保证 `references.bib` 只承载可 `\cite` 的 BibTeX 条目
- [x] 保证各 **`section_materials/<section>/` 下待引用 Markdown**（如 `citations.md`）与 `references.bib` 可对照（cite key 等）
- [x] `literature_review.md`：**可选**；若存在则承载综述脉络，不替代榜样论文（§5.4）
- [x] 允许同一篇论文同时出现在待引用集合与榜样集合，但 **语义与目录** 仍区分（§2.7-3）
- [x] 在 Research 输出或内部元数据中保留两套集合的说明，避免实现混用
- [x] 当前实现路径补充：在 `ResearchReport.artifactCollections` 中固化 `references` / `exemplars` 两套集合说明；`literature_review.md` 仅在 paper stage 显式产出时落盘，避免把 section citation 列表误当作综述正文

### 测试

- [x] `references.bib` 输出测试
- [x] 各 section 待引用 Markdown 输出测试
- [x] `literature_review.md` 可选路径测试
- [x] 文献检索结果与 `papers/` 目录边界测试
- [x] `parsePaperTextOutput`：BibTeX cite key 校验与 `citations.md` 对照测试
- [x] `renderSectionCitationsMarkdown` / `renderRoleAgentsMarkdown`：references-first 与 `papers/` / `source_sections/` 边界提示测试

### 验收标准

- [x] 正式引用与相关工作默认可走 **先 `references.bib`，再当前 section 对应 Markdown**（§2.7-4）
- [x] 写作风格与结构走 **`papers/`** 与 `source_sections/`，不依赖 `references.bib` 的目录结构

---

## T04 为每个 section 选择两篇榜样论文

### 目标

在 **`layout.md` 所定 target section** 上，Research 为 **每个** section **恰好** 选定两篇榜样论文（§2.9-4），落盘为 `paper_01/`、`paper_02/`；后续 Step Planner **直接引用** 该两篇已落盘材料，**不再**从多篇候选中另选（§2.9-4）。

### 代码落点

- `src/commands/research.ts`
- `src/research/pipeline.ts`
- `src/research/parsing.ts`
- `src/research/workspace.ts`
- `src/research/render.ts`
- `src/research/dry-run.ts`
- `src/research/section-materials.ts`

### 子任务

- [x] 以 **`layout.md`** 为准枚举 target section（与 `manuscript/sections/`、用户模板对齐）
- [x] 为每个 section 增加论文筛选逻辑（§2.10 默认提示词）
- [x] 每个 section **强制** 两篇榜样论文（`paper_01/`、`paper_02/`）
- [x] 为每篇论文生成稳定的本地 paper id（实现为固定目录名 `paper_01` / `paper_02`）
- [x] 为每个 section 创建：
  - [x] `section_materials/<section>/brief.md`（当前仍为占位，详细内容留给 T06）
  - [x] `section_materials/<section>/papers/paper_01/`
  - [x] `section_materials/<section>/papers/paper_02/`
- [x] 为每篇论文写 `meta.md`
- [x] `meta.md` 至少包含：
  - [x] `citation_key`
  - [x] `title`
  - [x] `pdf_url`（或等价可下载线索；无法核实须 `[待核实]`，§2.10）
  - [x] `short_intro`
  - [x] `why_relevant`
- [x] 明确 `short_intro` 必须是一句话且很短

### 测试

- [x] 每个 target section 是否**正好**两篇榜样论文测试
- [x] `meta.md` 生成测试
- [x] `short_intro` 长度限制测试
- [x] 论文目录命名稳定性测试（`paper_01` / `paper_02` 固定）

### 验收标准

- [x] 每个 target section 都有且只有两篇榜样论文
- [x] 每篇论文都有可读的标题和短简介
- [x] 后续下载与 Step Planner **只** 消费这两处目录，无需再猜候选集

---

## T05 下载 PDF 并按论文自身 section 落成 Markdown

### 目标

把选出的榜样论文真实下载到 workspace，并按论文自身 section 拆成完整 Markdown 文件。

### 代码落点

- `src/research/papers.ts`
- 复用 `src/media/pdf-extract.ts`
- `src/research/workspace.ts`
- `src/commands/research.ts`

### 子任务

- [x] 为每篇论文下载 `source.pdf`
- [x] 下载路径固定为 `section_materials/<section>/papers/paper_xx/source.pdf`
- [x] 调用 PDF 文本提取逻辑
- [x] 识别论文自身的 section heading
- [x] 按论文自身 section 拆分正文
- [x] 将 section Markdown 写到 `section_materials/<section>/papers/paper_xx/source_sections/`
- [x] 每个 section Markdown 至少包含：
  - [x] `paper_title`
  - [x] `citation_key`
  - [x] `section_title`
  - [x] `section_slug`
  - [x] 该 section 的 Markdown 正文
- [x] 无法稳定识别 heading 时，用启发式规则恢复 section 边界后再落盘
- [x] 记录失败原因，避免静默丢失 PDF（实现为 `source_failure.md`）
- [x] 若 `pdf_url` 仍是 `[待核实]` 或下载/提取失败，不伪造 `source_sections/`，而是在对应 `paper_xx/` 下落盘失败说明；避免把外部不可达误报为成功

### 测试

- [x] `source.pdf` 下载落盘测试
- [x] PDF 提取失败路径测试
- [x] section Markdown 文件生成测试
- [x] heading 拆分与启发式恢复回退测试
- [x] section Markdown 文件格式测试

### 验收标准

- [x] 每篇榜样论文在本地都有明确处理结果：成功时落 `source.pdf` + `source_sections/`，失败时落 `source_failure.md`
- [x] 对可提取正文的榜样论文，按论文自身 section 或启发式恢复边界落成 Markdown
- [x] 后续写作默认读取 `source_sections/`，不需要直接读整篇 PDF；若外部 PDF 不可得，阻塞点也已显式落盘

---

## T06 生成逐 section 的写作 brief 和 source section 映射

### 目标

为每个 section 生成 `brief.md`，并明确写作时应注入哪些 source section Markdown 文件。

### 代码落点

- 建议新增 `src/research/section-materials.ts`
- `src/research/render.ts`
- `src/research/parsing.ts`

### 子任务

- [x] 为每个 section 写 `brief.md`
- [ ] `brief.md` 至少包含：
  - [x] `section_id`
  - [x] `section_title`
  - [x] `writing_goal`
  - [x] 回答的问题
  - [x] 应避免的写法
  - [x] LaTeX 输出路径（须与用户 **`manuscript/sections/`** 及 **`layout.md`** 一致，§2.9）
- [x] 为每个目标 section 确定两篇榜样论文中需注入的 **`source_sections/*.md`** 集合（§2.9-4：风格来源已固定为已落盘的 `paper_01` / `paper_02`）
- [x] 在 `brief.md` 中记录：
  - [x] 本 section 对应的源 section 文件路径
  - [x] 对应 citation key
  - [x] 如需要，额外读取的 `references.bib` / `literature_review.md`
  - [x] 必要时可补充读取的实验结果路径
  - [x] 必要时可补充读取的已有 `.tex` 路径
- [x] 不再生成 `inject.md`

### 测试

- [x] `brief.md` 生成测试
- [x] `brief.md` 中源 section 文件路径测试
- [x] `brief.md` 中 citation key 映射测试
- [x] 不再生成 `inject.md` 测试

### 验收标准

- [x] 每个 section 都有可直接驱动写作的 `brief.md`
- [x] 写作时该注入哪些 source section 文件是明确且可追溯的
- [x] 不再引入额外的注入中间层

---

## T07 重写顶层 `todo.md` 和 Writing 任务表示

### 目标

把顶层 `todo.md` 收成 **6～10** 个大项（§2.11、§5.5），每条 **显式** 标注 **`coding`** 或 **`writing`**，且 **`coding` 在前、`writing` 在后**；Writing 必须是带 **`writing`** 标记的顶层任务，不靠关键词猜测（§5.5）。**输入** 仅为 `idea.md` + `specification.md`（§2.8-2）。

### 代码落点

- `src/research/render.ts`
- `src/research/types.ts`
- `src/research/parsing.ts`
- `src/research/prompts.ts`
- `src/research/roles.ts`
- `src/research/dry-run.ts`
- `src/research/*.test.ts`
- `src/commands/research.test.ts`

### 子任务

- [x] 定义顶层 `todo.md` 正式模板（对齐 §5.5 推荐形态，如 `- [ ] task_01 — **coding** — 标题`）
- [x] 每个大项映射到后续 task 目录，粗粒度即可；细则落在各 task 的 `plan.md`（§2.11）
  - 当前代码库仍使用 `tasks/Txx/` 兼容目录；本任务只修正顶层表示与显式类型，不在本轮重命名目录
- [x] **禁止** 在生成 `todo.md` 时读取 `layout.md`、文献检索产出、`section_materials/`（与 §2.11 实现注意一致）
- [x] 为 Writing 增加显式顶层任务（**`writing`** 标签）
- [x] 明确顶层 `todo.md` 与 `tasks/task_xx/plan.md` 的边界（§5.5-5、§5.6）
  - 顶层 `todo.md` 只保留项目级列表；细化步骤与逐轮状态下沉到 task 文件，后续 `plan.md` 迁移由 T08 承接

### 测试

- [x] `todo.md` 解析测试（含 **coding** / **writing** 字段）
- [x] 顶层任务数 **6～10** 边界测试
- [x] 生成 `todo.md` 时输入文件列表测试（不得含 `layout.md` 等）
- [x] Writing 顶层任务显式存在且带 **`writing`** 标记测试

### 验收标准

- [x] 顶层 `todo.md` 只表达项目级大项，不承担细粒度执行记录（§5.5）
- [x] 主会话能稳定从 `todo.md` 识别 **coding** 与 **writing** 任务及顺序预期

---

## T08 实现 `plan.md` 模板和 Section Queue 解析器

### 目标

让 `plan.md` 成为 task 的核心状态文件，并让 Writing task 支持 `Section Queue`；队列 **须与 `layout.md` 所列章节及 §2.9 固定顺序一致**，**不得**相对 `layout.md` 增删或重排章节（§5.6）。

### 代码落点

- `src/research/render.ts`
- `src/research/parsing.ts`
- `src/research/types.ts`
- `src/research/roles.ts`
- `src/research/prompts.ts`
- `src/commands/research.ts`

### 子任务

- [x] 定义普通 task 的 `Step List` 模板
- [x] 定义 Writing task 的 `Section Queue` 模板
- [ ] Writing queue item 至少包含：
  - [x] section id（与 **`layout.md`** 一致）
  - [x] `section_materials/<section>/`
  - [x] `manuscript/sections/<section>.tex`（与用户模板路径一致）
  - [x] acceptance
- [x] 从 **`layout.md`** 读取章节集合与顺序，填充 Section Queue（§2.9）
- [x] 增加 `## Blockers`
- [x] 增加 `## 最近执行结果`
- [x] 增加 `## Next Action Hint`
- [x] 写 `plan.md` 解析器
- [x] 写 `plan.md` 渲染器
- [x] 拒绝长段落 prose 式计划
- [x] 将 task 持久状态文件从 `tasks/Txx/todo.md` 切换为 `tasks/Txx/plan.md`，并让 tick / role prompt / 结果路径统一读取 `plan.md`

### 测试

- [x] 普通 task 模板渲染测试
- [x] Writing `Section Queue` 解析测试
- [x] step / queue item 缺失必填字段时的失败测试
- [x] 空 plan 或 prose-only plan 的拒绝测试
- [x] `最近执行结果` 只能写一句话的校验测试
- [x] `research tick` / CLI e2e 改为以 `plan.md` 为 task 真源的回归测试

### 验收标准

- [x] `plan.md` 成为主会话判断“是否可执行”的核心依据
- [x] Writing task 可以稳定解析成 section 队列，且与 **`layout.md`** 一致

---

## T09 固化根 `AGENTS.md` 和 worker 模板

### 目标

把主会话长期规则和 worker 角色模板收敛清楚，明确 OpenClaw 派发 Writing 时必须注入哪些材料。

### 代码落点

- `src/research/render.ts`
- `src/research/prompts.ts`
- `src/research/workspace.ts`

### 子任务

- [x] 重写根目录 `AGENTS.md`
  - [x] 只保留长期规则
  - [x] 明确 workspace 是真源
  - [x] 明确每轮只选一个 next action
  - [x] 明确 Writing 总是按 section 派发
  - [x] 明确派 Writing 时必须注入 section 材料
- [x] 为 `step_planner` 定义显式角色模板
- [x] 为 `coding` 定义显式角色模板
- [x] 为 `writing` 定义显式角色模板
- [x] 在 `agents/writing/AGENTS.md` 中写清：
  - [x] 使用 LaTeX
  - [x] 一次只写一个 section
  - [x] 优先读 `brief.md` 和秘书显式注入的 source section Markdown 集合
  - [x] 正式引用与相关工作：**先** `references.bib`，**再** 当前 section 下待引用 Markdown（§2.7-4）；`literature_review.md` 按需
  - [x] 榜样论文材料只用于写作风格和 section 组织（`papers/`、`source_sections/`）

### 测试

- [x] 根 `AGENTS.md` 关键条款测试
- [x] `agents/writing/AGENTS.md` 内容测试
- [x] 验证主会话不会错误依赖 `agents/*/AGENTS.md` 自动注入

### 验收标准

- [x] 主会话和 worker 的长期规则边界清晰
- [x] Writing 的输入合同在模板层面已经写死

---

## T10 实现 `stdout + plan.md` 反馈合同

### 目标

把 worker 反馈面收敛成“即时 `stdout` + 持久 `plan.md`”，不再引入 task 级 `status.json`。

### 代码落点

- `src/research/prompts.ts`
- `src/research/roles.ts`
- `src/research/parsing.ts`

### 子任务

- [x] 定义 worker `stdout` 的最小短格式
  - [x] `RESULT`
  - [x] `SUMMARY`
  - [x] `PLAN_UPDATE`
  - [x] `NEXT_HINT`
- [x] 明确 `stdout` 只做本轮简报，不做长期状态存储
- [x] 让 OpenClaw 主会话直接读取 raw `stdout`、`stderr`、exit code
- [x] 如需提取字段，只做薄解析
- [x] 让执行型 worker 在结束前必须更新当前 task 的 `plan.md`

### 测试

- [x] `stdout` 短格式测试
- [x] raw `stdout` / `stderr` / exit code 传递测试
- [x] `plan.md` 同步更新测试

### 验收标准

- [x] 主会话不需要 `status.json` 也能获得本轮反馈
- [x] worker 每轮结束后都能留下可持续推进的 `plan.md`

---

## T11 把主调度逻辑改成 workspace 驱动

### 目标

让 OpenClaw 主会话基于 `todo.md + plan.md + outputs/ + section_materials/` 选择唯一 next action；并落实 **§2.9**：**所有顶层 `coding` 任务完成后** 才允许进入 **`writing`**；章节顺序与 Section Queue 以 **`layout.md`** 为准。

### 代码落点

- OpenClaw 主会话 prompt
- `src/commands/research.ts`
- `src/research/render.ts`
- `src/research/dispatcher.ts`

当前实现路径说明：主调度入口实际位于 `src/commands/research.ts`，因此本任务将 workspace 判定逻辑抽到 `src/research/dispatcher.ts`，再由 tick 命令复用；保留 `roles.ts` 中 worker 级 role 选择辅助函数，不再把主调度判断散落在命令函数里。

### 子任务

- [x] 主会话先看 `todo.md`（识别 **coding** / **writing** 大项）
- [x] 再看当前未完成 task 的 `plan.md`
- [x] 无 `plan.md` 时选择 Step Planner
- [x] `plan.md` 有可执行步骤时选择 Coding
- [x] `plan.md` 存在 blocker 时回 Step Planner
- [x] **Writing 门闸**：若顶层仍存在未完成的 **coding** 任务，**不得** 派发 **writing**（§2.9-3）
- [x] 派发 Writing 时，Section Queue 与 `layout.md` 一致性检查（§5.6）
- [x] 某个 section 的材料完整存在时允许派 Writing（在通过 Writing 门闸后）
- [x] 派 Writing 前检查：
  - [x] `brief.md`
  - [x] 所选 source section Markdown 文件集合（来自已落盘的 **`paper_01` / `paper_02`**）
  - [x] 两篇论文目录存在
  - [x] 目标 `.tex` 输出路径与 `layout.md` / 用户模板一致
  - [x] 如 `brief.md` 声明需要引用或 related work，再检查 `references.bib`、当前 section 待引用 Markdown、`literature_review.md`（按需）
- [x] worker 的 `stdout` 只作为辅助判断，不能覆盖 workspace 真源

### 测试

- [x] 无 `plan.md` 时是否选 Step Planner
- [x] 有 `plan.md` 且有可执行步骤时是否选 Coding
- [x] `plan.md` 有 blocker 时是否回 Step Planner
- [x] **coding 未完成时是否禁止 Writing**
- [x] section 材料完整存在时是否允许派 Writing（coding 已全部完成）
- [x] 缺所选 source section Markdown 时是否禁止派 Writing

### 验收标准

- [x] 主调度逻辑只基于 workspace 真源做判断
- [x] 主会话不会在材料不完整时乱派 Writing
- [x] 不会在 **coding 未完成** 时进入 Writing 任务

---

## T12 对齐 worker 输出合同

### 目标

让 worker 每次执行后都写出规范要求的最小结果集合，并让后续 worker 能直接消费。

### 代码落点

- `src/research/prompts.ts`
- `src/research/roles.ts`
- `src/research/workspace.ts`
- `src/commands/research.ts`

补充说明：当前代码库里真正负责 worker 执行后验收的是 `research tick` 调度链，因此本任务将执行后合同校验落在 `src/commands/research.ts`；仅改 prompt / role 模板不足以保证 workspace 真正落盘。

### 子任务

- [x] Coding 结束后必须：
  - [x] 更新 `plan.md`
  - [x] 写 `summary.md`
  - [x] 写 `outputs/result.json`
  - [x] 追加 `logs/run.log`
  - [x] 输出短 `stdout`
- [x] Writing 结束后必须：
  - [x] 更新 `plan.md`
  - [x] 写 `manuscript/sections/<section>.tex`
  - [x] 必要时更新 `runtime/session_notes.md`
  - [x] 输出短 `stdout`
- [x] Writing 必须使用 `\cite{}`，不能伪造引用
- [x] 初始化 task 目录时预建 `summary.md`、`outputs/`、`logs/` 骨架，避免后续 worker 因路径缺失破坏结果合同
- [x] `research tick` 在 worker 返回后强制校验对应合同；不满足时直接报错，避免“prompt 说了但没落盘”

### 测试

- [x] Coding 输出文件存在测试
- [x] Writing `.tex` 输出路径测试
- [x] Writing LaTeX 引用格式测试
- [x] 失败时日志和现有输出不丢失测试
- [x] task 结果文件骨架初始化测试

### 验收标准

- [x] 任何一次 worker 执行结束后，workspace 都能自解释
- [x] Writing 产物是真正的 LaTeX section 文件

---

## T13 接通逐 section 的 LaTeX Writing 链路

### 目标

把 Writing 变成真正按 section 消费源 section Markdown 并写出 LaTeX 的 worker。

### 代码落点

- `src/research/render.ts`
- `src/research/prompts.ts`
- `src/research/roles.ts`
- 建议新增 `src/research/writing.ts`

### 子任务

- [x] 定义 section 级写作任务包格式
- [x] Writing 任务包至少包含：
  - [x] 当前 section id
  - [x] `brief.md`
  - [x] 所选 source section Markdown 文件路径列表
  - [x] 输出 `.tex` 路径
  - [x] 必要时的结果文件路径
  - [x] 必要时的 citation key 范围
- [x] 明确 Writing 必须读取：
  - [x] `agents/writing/AGENTS.md`
  - [x] 本轮 section 任务包
  - [x] `brief.md`
  - [x] 所选 source section Markdown 文件集合
- [x] 明确 Writing 仅在 `brief.md` 声明时再读取：
  - [x] `literature_review.md`
  - [x] `summary.md`
  - [x] `outputs/result.json`
  - [x] `references.bib` 与当前 section 下待引用 Markdown（§2.7-4）
  - [x] 已有 `.tex`
- [x] 明确 Writing 每次只写一个 section
- [x] 明确 Writing 不允许跨 section 发散
- [x] 必要时增加 LaTeX 语法 sanity check

### 测试

- [x] section 任务包生成测试
- [x] `brief.md` / source section Markdown 集合注入测试
- [x] Writing 一次只写一个 section 测试
- [x] `.tex` 产物存在测试
- [x] LaTeX 基本结构测试

### 验收标准

- [x] Writing 按 section 稳定执行
- [x] 两篇论文的拆分材料真正参与了写作注入
- [x] 引用链路与榜样论文链路不会混淆
- [x] 写作结果能稳定落到 `.tex` 文件

---

## T14 长任务链路和 supervisor

### 目标

把长任务从 Coding Worker 的阻塞执行里拆出去，改成后台作业 + supervisor + 完成后 wake 主会话。

### 代码落点

- `src/research/workspace.ts`
- `src/research/roles.ts`
- `src/commands/research.ts`
- `src/research/jobs.ts`
- `src/cli/program/register.research.ts`

### 子任务

- [x] 定义什么算短任务，什么算长任务
  - 当前实现定义：**预计 15 分钟内**可完成的改代码、单测、sanity check、小规模 dry-run 属于短任务；超过该范围、需要后台训练 / 评测 / 守护进程的视为长任务
- [x] Coding 只负责为长任务准备：
  - [x] 脚本
  - [x] 配置
  - [x] 输出路径
  - [x] `launch.sh`
  - [x] `job.json`
  - [x] （可选）`monitor.sh`（见 specification **§4** workspace 示例、**§13** 长任务）
- [x] 主会话不直接阻塞跑长任务
- [x] supervisor 负责：
  - [x] 跟踪 job id 或 service name
  - [x] 检查日志
  - [x] 检查输出目录
  - [x] 更新 `summary.md`
  - [x] 更新 `outputs/result.json`
  - [x] 在 `plan.md` 写最近结果或 blocker
  - [x] 完成后发固定 wake
  - [x] 当前实现说明：优先执行 task 内 `monitor.sh`；若未提供，则回退到内建 supervisor，按 `job.json` 中的 `pid` / `serviceName` / `result.json` 轮询终态
- [x] 如需机器可读长任务状态，只写到 `job.json`

### 测试

- [x] 长任务准备文件生成测试
- [x] `job.json` schema 测试
- [x] `launch.sh` 存在性和可执行位测试
- [x] 长任务结束后 `plan.md` 是否被更新测试
- [x] 长任务结束后是否自动 wake 主会话测试

### 验收标准

- [x] 长任务不再占住 Coding Worker 会话
- [x] 主会话始终只做调度，不做长时间阻塞执行

---

## T15 最小闭环集成验收

### 目标

跑通规范定义的最小闭环，而不是只跑单点单元测试。

### 代码落点

- `src/cli/research-run.e2e.test.ts`
- `src/commands/research.workflow.e2e.test.ts`

### 当前实现路径（T15 范围内调整）

为避免把闭环验收绑死到真实网关、真实 LLM 和外部 PDF 服务，当前 T15 采用两层集成验证：

1. **CLI e2e**：通过 `openclaw research run --dry-run` + 多次 `research tick`，配合受控 `codex` stub，覆盖主会话从 Step Planner → Coding 失败 → 回 Step Planner → Coding 成功 → Writing 的最小调度闭环。
2. **Workflow e2e**：通过 `researchRunCommand` 的 live pipeline（mocked Responses API + mocked PDF 提取），覆盖 `research run` 的静态 workspace 生成、自动 wake、文献检索 / citations 与榜样论文分离、PDF 下载与 `source_sections/*.md` 落盘，再衔接一次失败回退与按 section 写出 LaTeX。

以上两层都只使用仓库内受控 mock / 脚手架，不改变规范语义：`manuscript/` 仍作为用户侧前置模板，Research 仍只负责静态 workspace 与 wake。

### 子任务

- [x] 输入一个粗糙 idea（或上游注入）
- [x] 用户侧准备 **`manuscript/` 投稿模板**（§3.1；e2e 用脚手架预置，但与规范语义区分）
- [x] 生成核心文件（含 **`layout.md`**、`idea.md`、`specification.md` 等）
- [x] 按 §2.8：**并行** 文献检索与引用产物 + 落盘；再生成 **仅由 idea+spec 输入** 的 `todo.md`；再完成榜样论文落盘
- [x] 为每个 target section 生成 `section_materials/<section>/`（待引用 Markdown + `papers/`）
- [x] 为每个 section 选出两篇榜样论文并下载
- [x] 为每篇论文生成 `meta.md` 和 `source_sections/*.md`
- [x] 为每个 section 生成 `brief.md`
- [x] 校验 `manuscript/sections/*.tex` 与 **`layout.md`** 可对齐（不强制由 Research 生成模板）
- [x] `research run` 完成后自动 wake 主会话
- [x] 主会话先选择 Step Planner
- [x] 再选择 Coding
- [x] 模拟一次 Coding 失败
- [x] 归档旧 `plan.md`
- [x] 生成新 `plan.md`
- [x] 产出 `summary.md`、`result.json`、`run.log`
- [x] 让 Writing 按 section 写出 `.tex`

### 测试

- [x] 最小闭环 e2e
- [x] 文献检索结果与榜样论文分离 e2e
- [x] 论文下载与拆分 e2e
- [x] 失败回退 e2e
- [x] 重规划版本化 e2e
- [x] Writing 按 section 消费材料并产出 LaTeX e2e
- [x] 无 `status.json` 的闭环验证

### 验收标准

- [x] 从 idea 到主会话唤醒到 worker 输出的链路闭合
- [x] 即使经过一次失败和重规划，系统仍能继续推进

---

## 推荐实现顺序

实现 Research 管线时，须按 **§2.8** 区分：**并行**（spec + 文献与 citations + layout）→ **`todo.md`（仅 idea+spec）** → **榜样论文落盘**；`T02`–`T05` 与此顺序强相关。

1. `T01` 对齐 workspace 总目录结构
2. `T02` 对齐 Research 阶段核心产物、文献检索输出和 section 映射
3. `T03` 固化文献检索结果面
4. `T04` 为每个 section 选择两篇榜样论文
5. `T05` 下载 PDF 并按论文自身 section 落成 Markdown
6. `T06` 生成逐 section 的写作 brief 和 source section 映射
7. `T07` 重写顶层 `todo.md` 和 Writing 任务表示
8. `T08` 实现 `plan.md` 模板和 Section Queue 解析器
9. `T09` 固化根 `AGENTS.md` 和 worker 模板
10. `T10` 实现 `stdout + plan.md` 反馈合同
11. `T11` 把主调度逻辑改成 workspace 驱动
12. `T12` 对齐 worker 输出合同
13. `T13` 接通逐 section 的 LaTeX Writing 链路
14. `T14` 接通长任务和 supervisor
15. `T15` 做最小闭环集成验收

---

## 总体验收标准

- [ ] 生成结果目录与 `specification.md`（**§4、§2.7–§2.11**）一致
- [ ] 存在 **`layout.md`（落盘约定）** 且为章节真源；Section Queue **不**偏离 `layout.md`
- [ ] **`todo.md` 生成** 仅使用 `idea.md` + `specification.md`，不以文献或 `layout.md` 为输入
- [ ] `research run` 只生成静态 workspace 并自动 wake 主会话；**不**把生成投稿模板包当作 Research 职责（§3.1）
- [ ] 主会话只靠 workspace 文件就能调度
- [ ] `stdout` 负责即时反馈，`plan.md` 负责持久状态
- [ ] 文献检索结果（`references.bib`、各 section 待引用 Markdown 等）与榜样论文（`papers/`）在职责上明确分离
- [ ] 每个 target section 都有两篇榜样论文的本地材料（`paper_01` / `paper_02`）
- [ ] 每篇榜样论文都已下载并按论文自身 section 落成 Markdown
- [ ] 写作时只注入目标 section 对应的源 section Markdown
- [ ] 正式引用与相关工作：**先** `references.bib`，**再** 当前 section 待引用 Markdown；`literature_review.md` 按需（§2.7）
- [ ] 写作风格与结构依赖榜样论文 section 材料
- [ ] **所有顶层 coding 完成后** 才进入 writing；Writing 产物是逐 section 的 LaTeX（§2.9）
- [ ] Coding 失败后必回 Step Planner
- [ ] `plan.md` 可版本化
- [ ] 长任务不阻塞主调度链路
- [ ] 最小闭环可以稳定跑通
