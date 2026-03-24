# 第三方中转站 524 报错说明

## 1. 复现命令

我们运行的是下面这条命令：

```bash
cd /home/jin/research-god && ( set -a; source .env; set +a; bash ./scripts/run_research_xhigh_hivemind_poll.sh ) | tee /tmp/research-xhigh-poll.log
```

脚本里的关键参数如下：

- 模型：`openai/gpt-5.4`
- thinking：`xhigh`
- responseMode：`poll`
- pollIntervalMs：`10000`
- requestTimeoutMs：`7200000`
- idea：`更好的test time computation的方法 针对开放领域科学发现任务比如 hivemind`

## 2. 实际现象

程序刚进入第一个阶段 `idea`。

这时就报错了。

还没有进入后面的：

- `writing_structure`
- `specification`
- `paper`
- `todo`

所以这次失败发生得很早。

## 3. 报错原文

```text
Running research stage: idea
/home/jin/research-god/src/commands/research.openai.ts:563
    throw new ResearchApiError(`OpenAI Responses API error: ${parsed.message}`, {
          ^

ResearchApiError: OpenAI Responses API error: 524 Receive timeout from origin
    at createResponse (/home/jin/research-god/src/commands/research.openai.ts:563:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async runResearchApiRequest (/home/jin/research-god/src/commands/research.openai.ts:676:17)
    at async runStage (/home/jin/research-god/src/research/pipeline.ts:17:10)
    at async researchRunCommand (/home/jin/research-god/src/commands/research.ts:392:26)
    at async file:///home/jin/research-god/[eval1]:53:16 {
  status: 524,
  code: undefined,
  param: undefined
}
```

## 4. 这次报错发生在哪一步

不是在“轮询查结果”的时候报错。

是更早的一步报错。

是创建 response 的时候报错。

也就是：

- 本地先发 `POST /responses`
- 想先创建一个后台任务
- 但中转站先返回了 `524`

所以这次还没有走到后面的：

- `GET /responses/{id}`

换句话说：

不是“任务创建成功了，但查结果失败”。

而是“任务创建这一下就失败了”。

## 5. 我们对原因的判断

我们的判断很直接：

- 这不是本地脚本自己超时
- 也不是我们本地设置的 2 小时超时到了
- 而是中转站在等待上游返回时，自己先超时了

说得更直白一点：

1. 我们把请求发给中转站
2. 中转站再把请求转给上游
3. 上游还没返回完整结果
4. 中转站先等不住了
5. 中转站回了 `524 Receive timeout from origin`

## 6. 为什么我们会这样判断

原因有三点。

第一，报错发生在 `createResponse(...)`。

这说明失败点是：

- `POST /responses`

不是轮询。

第二，这次返回的是 HTTP 524。

这说明是服务端返回了错误响应。

不是本地代码主动取消了请求。

第三，我们用官方 API 时，没有这个问题。

所以模型本身不是根因。

更像是中转站这一层的等待时间不够长，或者中转链路上有更短的超时限制。

## 7. 我们希望协助确认的点

请帮忙确认下面这些点：

1. 中转站对 `POST /responses` 的最长等待时间是多少。
2. 这个等待时间是不是比官方短很多。
3. 中转站前面是否还有代理、网关或 CDN。
4. 这些中间层是否会先触发超时。
5. 当请求里带 `background: true` 时，是否仍然会走同样的超时链路。
6. 对 `gpt-5.4 + xhigh` 这类慢请求，是否有单独限制。

## 8. 我们这边已经确认过的事

我们已经确认过下面这些事：

- 已经使用轮询模式，不是一直单条连接死等结果
- 但这次错误发生在“创建任务”这一步
- 所以轮询逻辑还没真正开始
- 本地请求超时已经设到了 2 小时
- 但这次不是本地 2 小时超时

## 9. 一句话总结

这次问题不是我们本地代码先断开。

而是中转站在 `POST /responses` 这一步等待上游返回时，先返回了：

- `524 Receive timeout from origin`

如果需要，我们也可以继续提供：

- 这次 `idea` 阶段的完整 prompt
- 更完整的日志
- 同一请求在官方 API 下的对比结果
