# Poll 模式下仍会出现 524 的原因说明

这份文档记录的是：

- 使用第三方中转站
- 使用 `openai/gpt-5.4`
- 使用 `thinking=xhigh`
- 使用 `responseMode=poll`

时，为什么仍然会报：

```txt
ResearchApiError: OpenAI Responses API error: 524 Receive timeout from origin
```

## 先说结论

`poll` 只解决了“怎么拿结果”。

它没有解决“怎么创建任务”。

这次的 `524`，不是出在轮询查询。

它出在第一步：

- `POST /responses`

也就是：

- 连后台任务都还没建起来
- 中转站就先超时了

所以：

- `poll` 不是没生效
- 而是还没轮到它发挥作用

## 这次卡在哪里

从实际输出看，阶段顺序是：

- `idea`
- `writing_structure`
- `specification`
- `paper`

然后报错。

报错点在：

- `createResponse(...)`

这表示失败发生在：

- 创建 Responses 任务

不是发生在：

- `GET /responses/{id}` 轮询状态

说白了：

- `paper` 阶段刚开始提交
- 中转站就先断了

## 为什么 poll 模式也会遇到这个问题

`poll` 模式的流程其实是两段。

第一段：

1. `POST /responses`
2. 拿到一个 `response id`

第二段：

1. 反复 `GET /responses/{id}`
2. 看任务有没有完成

这次失败在第一段。

也就是说：

- 任务 ID 还没拿到
- 根本还没开始轮询

所以 `poll` 模式也挡不住这类错误。

## 这次真正触发 524 的 prompt 是哪一个

这次最可能触发 `524` 的，不是 `idea` prompt。

是：

- `paper` 阶段的 prompt

而且在第三方中转站环境下，默认不是走轻量的 `previous_response_id` 版本。

而是走：

- `buildPaperPromptWithContext(...)`

原因很简单。

当前代码在非官方 `api.openai.com` 环境下，会默认认为：

- `previous_response_id` 不可靠

所以它会把上游上下文直接拼进 prompt。

也就是：

- 原始 idea
- refined idea
- sections JSON

都会直接塞进 `paper` prompt 里。

## 这个 prompt 为什么重

因为它同时要求模型做很多事。

它不是只找几篇论文。

它要同时产出：

- `===BIB===`
- `===PAPERS===`
- `===EXEMPLARS===`
- 可选的 `===LITERATURE_REVIEW===`

而且它还要求：

- 尽量使用工具
- 尤其是 `web search`
- 每个 section 都要按规范分配文献
- 每个 section 都要给两篇 exemplar paper
- exemplar 还要带 `citation_key`
- 还要带 `pdf_url`
- 还要带 `short_intro`
- 还要带 `why_relevant`

这会让请求很重。

## 这次 prompt 里最容易把请求变重的点

可以直接概括成 6 个点。

### 1. `thinking=xhigh`

这是最高思考强度。

本来就慢。

### 2. 用了显式上下文

因为当前是第三方中转站。

所以不是简单接前文。

而是把这些内容重新塞进 prompt：

- seed idea
- refined idea
- sections JSON

prompt 更长。

请求更重。

### 3. `paper` 阶段本身最重

它不是写一段文字。

它要做文献检索。

还要做分组。

还要做引用和榜样论文的双轨输出。

### 4. 它鼓励强工具使用

prompt 明确说：

- 尽量使用可用工具
- 尤其是 web search

这会增加请求执行时间。

### 5. 输出上限更大

`paper` 阶段单独给了更高的 `max_output_tokens`。

所以服务端会把它当成一个更大的任务。

### 6. 第三方中转站比官方更容易先断

官方 API 通常更能扛这种长请求。

第三方中转站前面往往还有：

- 代理
- 网关
- CDN

这些层常常等不了这么久。

于是模型还没跑完。

中转站先返回了：

- `524 Receive timeout from origin`

## 这不是哪几种问题

这次不是下面这些问题：

- 不是 JSON schema 解析失败
- 不是本地脚本 2 小时超时
- 不是轮询的 `GET /responses/{id}` 逻辑错了
- 不是 `todo` 阶段的问题

根因更前面。

它就是：

- `paper` 阶段第一次提交请求太重
- relay 没等到结果
- 先超时了

## 这次现象和代码的对应关系

可以直接记成这一条：

- `poll` 只改变“如何拿结果”
- 不改变“创建任务这一步本身有多重”

所以如果：

- `POST /responses` 这一步就超时

那后面的轮询根本没机会执行。

## 当前版本已经做了什么补救

已经改了写盘方式。

现在是：

- `idea` 成功就写 `idea.md`
- `writing_structure` 成功就写 `layout.md`
- `specification` 成功就写 `specification.md`
- `paper` 成功才写 `references.bib`
- `todo` 成功才写 `todo.md`

这能解决一个实际问题：

- 后面再来一个 `524`
- 前面已经成功的文件不会白跑

## 最后一句话

这次 `524` 的核心不是：

- `poll` 模式坏了

而是：

- `paper` 阶段的创建请求太重
- 第三方中转站在这一步先超时了

所以：

- `poll` 能改善“长时间等结果”的问题
- 但不能保证“创建任务本身一定成功”

