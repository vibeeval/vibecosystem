[← Back to English](../README.md)

# vibecosystem

**Claude Code 上に構築された AI ソフトウェアチーム。**

137 の Agent。260 の Skill。53 の Hook。手作業ゼロ。

## 一目でわかる概要

| 指標 | 数 |
|--------|-------|
| Agents | **137** |
| Skills | **269** |
| Hooks | **53** |
| Rules | **22** |
| 手作業 | **0** |

## これは何？

vibecosystem は Claude Code を完全な AI ソフトウェアチームに変えます。単なるアシスタントではなく、設計、構築、レビュー、テストを行い、あらゆるミスから学習する 136 の専門 agent からなる**チーム**です。

カスタムモデルなし。カスタム API なし。Claude Code の hook + agent + rules システムだけを、限界まで活用しています。

### 全体像

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

## コア機能

### 1. 自己学習パイプライン

すべてのエラーが自動的にルールになります。

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

手動の介入は不要です。システムが自分自身のルールを書きます。

### 2. Agent Swarm

「新機能を追加して」と言うだけで、20 以上の agent が 5 つのフェーズにわたって起動します。

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. 適応型 Hook ローディング

53 の hook がありますが、すべてが同時に実行されるわけではありません。ユーザーの意図に応じて、必要な hook だけが発火します。

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

すべてのタスクは品質ゲートを通過します：

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

1 つの agent がミスをすると、チーム全体がそこから学びます。

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

74 行のルーティングテーブル：すべてのタスクタイプが適切な agent にマッピングされます。

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Hooks   │  │  Agents  │  │  Skills  │              │
│  │  (53)    │→ │  (137)   │← │  (269)   │              │
│  └────┬─────┘  └────┬─────┘  └──────────┘              │
│       │              │                                   │
│       ▼              ▼                                   │
│  ┌──────────┐  ┌──────────┐                              │
│  │  Rules   │  │  Memory  │                              │
│  │  (22)    │  │ (PgSQL)  │                              │
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

## Agent カテゴリ

| カテゴリ | 数 | 例 |
|----------|-------|---------|
| Core Dev | 14 | frontend-dev, backend-dev, kraken, spark, devops, website-cloner |
| Review & QA | 8 | code-reviewer, security-reviewer, verifier, qa-engineer |
| Domain Experts | 35 | graphql-expert, kubernetes-expert, ddd-expert, redis-expert |
| Architecture | 8 | architect, planner, clean-arch-expert, cqrs-expert |
| Testing | 6 | tdd-guide, e2e-runner, arbiter, mocksmith |
| DevOps & Cloud | 12 | aws-expert, gcp-expert, azure-expert, terraform-expert |
| Analysis | 11 | scout, sleuth, data-analyst, profiler, strategist |
| Orchestration | 16 | nexus, sentinel, commander, neuron, vault, nitro |
| Documentation | 6 | technical-writer, doc-updater, copywriter, api-doc-generator, document-generator |
| Learning | 7 | self-learner, canavar, reputation-engine, session-replay-analyzer |

## 技術スタック

| コンポーネント | 技術 |
|-----------|-----------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

## 設計思想

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

カスタムモデルなし。カスタム API なし。あるのは優れたエンジニアリングだけ。

</div>
