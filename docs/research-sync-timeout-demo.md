# Sync 模式失败样例

这份说明记录的是 `非轮询 / sync` 模式下的一次真实失败样例。

## 场景

- 目标：跑 `research run`
- 模型：`openai/gpt-5.4`
- thinking：`xhigh`
- 调用方式：同步等待一个 `/responses` 请求返回
- API：第三方中转站，不是官方 `api.openai.com`
- 当前 idea：
  `更好的test time computation的方法 针对开放领域科学发现任务比如 hivemind`

## 起因

- 请求很重。
- 这是第一个 `idea` 阶段。
- `gpt-5.4 + xhigh` 本来就会慢。
- 当前代码在 sync 模式下，会一直挂着等这一轮 `/responses` 返回。
- 这条链路经过第三方中转站。

代码入口：
- [research.ts](/home/jin/research-god/src/commands/research.ts#L381)
- [research.openai.ts](/home/jin/research-god/src/commands/research.openai.ts#L472)

## 跑了多长时间

- 从现有落盘日志里，只能确认它进入了 `idea` 阶段：
  `Running research stage: idea`
- 这条日志在 [/tmp/research-xhigh.log](/tmp/research-xhigh.log)。
- 现有本地文件里没有完整的开始时间和结束时间。
- 所以这次**无法精确还原秒数**。
- 但可以确认：它不是本地 `2 小时` 超时触发的。
- 它是在本地还愿意继续等的时候，被中转站先返回了错误。

## 返回报错

控制台报错是：

```txt
ResearchApiError: OpenAI Responses API error: 524 Receive timeout from origin
```

完整关键信息是：

```txt
Running research stage: idea

ResearchApiError: OpenAI Responses API error: 524 Receive timeout from origin
  status: 524
```

错误包装位置：
- [research.openai.ts](/home/jin/research-god/src/commands/research.openai.ts#L442)

本地超时逻辑位置：
- [research.openai.ts](/home/jin/research-god/src/commands/research.openai.ts#L472)

## 我对这个报错的分析

- 这不是模型内容格式错了。
- 这不是 schema 解析报错。
- 这也不是本地脚本等满了 `2 小时`。
- 这是第三方中转站返回的 `524`。

说人话：

- 你的请求已经发出去了。
- 中转站也把请求转给上游了。
- 上游还没把结果算完。
- 但中转站自己等不住了。
- 所以它先断开，回了一个 `524`。

## 为什么官方 API 没这个问题

- 官方 API 本身更能扛这种长时间同步等待。
- 你现在这个第三方中转站前面大概率还有代理或 CDN。
- 这层通常会有更短的等待上限。
- 所以同样的请求，官方能等，中转站先断。

## 结论

- 这次失败发生在第一个 `idea` 阶段。
- 问题点不在 prompt 文本本身。
- 问题点也不在 JSON/schema。
- 主要问题是：`sync` 模式下，`gpt-5.4 + xhigh` 的单次请求太长，而第三方中转站扛不住。

## 后续建议

- 保留当前 sync 版本，方便和官方 API 对比。
- 对第三方中转站，优先用 `poll` 版本。
- 如果还坚持 sync，就要换一个更能等的 relay。
