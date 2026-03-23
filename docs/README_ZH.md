[← Back to English](../README.md)

# vibecosystem

**基于 Claude Code 构建的 AI 软件团队。**

119 个 Agent。208 项 Skill。49 个 Hook。零人工干预。

## 概览

| 指标 | 数量 |
|--------|-------|
| Agents | **119** |
| Skills | **208** |
| Hooks | **49** |
| Rules | **21** |
| 人工操作 | **0** |

## 这是什么？

vibecosystem 将 Claude Code 变成了一支完整的 AI 软件团队。不是一个助手，而是由 119 个专业 agent 组成的**团队** -- 它们负责规划、构建、审查、测试，并从每一个错误中学习。

无需自定义模型。无需自定义 API。仅凭 Claude Code 的 hook + agent + rules 系统，发挥到极致。

### 全景图

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

## 核心功能

### 1. 自学习流水线

每一个错误都会自动变成规则。

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

无需人工介入。系统自己编写自己的规则。

### 2. Agent Swarm

只需说"添加一个新功能"，20 多个 agent 就会在 5 个阶段中协同启动。

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. 自适应 Hook 加载

49 个 hook 并非同时运行。用户意图决定哪些 hook 被触发。

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

每个任务都必须通过质量关卡：

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

当一个 agent 犯错时，整个团队都会从中学习。

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

74 行的路由表：每种任务类型都映射到最合适的 agent。

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Hooks   │  │  Agents  │  │  Skills  │              │
│  │  (49)    │→ │  (119)   │← │  (208)   │              │
│  └────┬─────┘  └────┬─────┘  └──────────┘              │
│       │              │                                   │
│       ▼              ▼                                   │
│  ┌──────────┐  ┌──────────┐                              │
│  │  Rules   │  │  Memory  │                              │
│  │  (21)    │  │ (PgSQL)  │                              │
│  └──────────┘  └──────────┘                              │
│                                                         │
│  ┌──────────────────────────────────────┐                │
│  │  Self-Learning Pipeline             │                │
│  │  instincts → consolidate → rules    │                │
│  └──────────────────────────────────────┘                │
│                                                         │
│  ┌──────────────────────────────────────┐                │
│  │  Canavar Cross-Training             │                │
│  │  error-ledger → skill-matrix → team │                │
│  └──────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

## Agent 分类

| 类别 | 数量 | 示例 |
|----------|-------|---------|
| Core Dev | 12 | frontend-dev, backend-dev, kraken, spark, devops |
| Review & QA | 8 | code-reviewer, security-reviewer, verifier, qa-engineer |
| Domain Experts | 35 | graphql-expert, kubernetes-expert, ddd-expert, redis-expert |
| Architecture | 8 | architect, planner, clean-arch-expert, cqrs-expert |
| Testing | 6 | tdd-guide, e2e-runner, arbiter, mocksmith |
| DevOps & Cloud | 12 | aws-expert, gcp-expert, azure-expert, terraform-expert |
| Analysis | 10 | scout, sleuth, data-analyst, profiler, strategist |
| Orchestration | 16 | nexus, sentinel, commander, neuron, vault, nitro |
| Documentation | 5 | technical-writer, doc-updater, copywriter, api-doc-generator |
| Learning | 7 | self-learner, canavar, reputation-engine, session-replay-analyzer |

## 技术栈

| 组件 | 技术 |
|-----------|-----------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

## 设计哲学

```
hooks are sensors. observe, filter, signal.
agents are muscles. build, produce, fix.
the bridge between them: context injection.
no direct RPC. no message passing. by design.
implicit coordination through context.
```

---

## License

MIT

---

<div align="center">

**Built by [@vibeeval](https://x.com/vibeeval)**

无需自定义模型。无需自定义 API。只靠扎实的工程实践。

</div>
