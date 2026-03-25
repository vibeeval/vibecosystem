[← Back to English](../README.md)

# vibecosystem

**Claude Code 위에 구축된 AI 소프트웨어 팀.**

121개의 Agent. 223개의 Skill. 49개의 Hook. 수동 작업 제로.

## 한눈에 보기

| 지표 | 수량 |
|--------|-------|
| Agents | **121** |
| Skills | **223** |
| Hooks | **49** |
| Rules | **21** |
| 수동 작업 | **0** |

## 이게 뭔가요?

vibecosystem은 Claude Code를 완전한 AI 소프트웨어 팀으로 바꿉니다. 단순한 어시스턴트가 아닌, 설계하고, 구축하고, 리뷰하고, 테스트하고, 모든 실수로부터 학습하는 121개의 전문 agent로 구성된 **팀**입니다.

커스텀 모델 없음. 커스텀 API 없음. Claude Code의 hook + agent + rules 시스템만으로, 한계까지 끌어올렸습니다.

### 전체 그림

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

## 핵심 기능

### 1. 자기학습 파이프라인

모든 에러가 자동으로 규칙이 됩니다.

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

수동 개입이 필요 없습니다. 시스템이 스스로 규칙을 작성합니다.

### 2. Agent Swarm

"새 기능을 추가해"라고 말하면 20개 이상의 agent가 5단계에 걸쳐 활성화됩니다.

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. 적응형 Hook 로딩

49개의 hook이 있지만 동시에 전부 실행되지는 않습니다. 사용자의 의도에 따라 필요한 hook만 실행됩니다.

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

모든 태스크는 품질 게이트를 통과해야 합니다:

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

하나의 agent가 실수하면 팀 전체가 그로부터 학습합니다.

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

74행의 라우팅 테이블: 모든 태스크 유형이 적합한 agent에 매핑됩니다.

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

## 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Hooks   │  │  Agents  │  │  Skills  │              │
│  │  (49)    │→ │  (121)   │← │  (223)   │              │
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

## Agent 카테고리

| 카테고리 | 수량 | 예시 |
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

## 기술 스택

| 구성 요소 | 기술 |
|-----------|-----------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

## 설계 철학

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

커스텀 모델 없음. 커스텀 API 없음. 오직 탄탄한 엔지니어링.

</div>
