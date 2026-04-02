[← Back to English](../README.md)

<div align="center">

# vibecosystem

**Команда разработки на базе ИИ, построенная на Claude Code.**

137 agents. 271 skills. 60 hooks. Ноль ручной работы.

<img src="../assets/gif1-numbers.gif" alt="Ecosystem Numbers" width="700">

</div>

---

## Обзор

| Показатель | Количество |
|------------|------------|
| Agents | **137** |
| Skills | **269** |
| Hooks | **53** |
| Rules | **22** |
| Ручная работа | **0** |

---

## Что это?

vibecosystem превращает Claude Code в полноценную ИИ-команду разработки. Не одного ассистента -- **команду** из 136 специализированных агентов, которые планируют, создают, проверяют, тестируют и учатся на каждой ошибке.

Без собственной модели. Без собственного API. Только система hooks + agents + rules Claude Code, использованная на максимум.

### Общая картина

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

---

## Ключевые возможности

### 1. Конвейер самообучения

Каждая ошибка становится правилом. Автоматически.

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

Никакого ручного вмешательства. Система пишет собственные правила.

### 2. Agent Swarm

Скажите "добавь новую фичу" -- и более 20 агентов активируются в 5 фазах.

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. Адаптивная загрузка хуков

Существует 53 хуков, но они не запускаются все одновременно. Намерение определяет, какие хуки срабатывают.

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

Каждая задача проходит через контроль качества:

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

Когда один агент допускает ошибку, вся команда извлекает из неё урок.

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

Таблица маршрутизации из 74 строк: каждый тип задачи направляется нужному агенту.

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

---

## Архитектура

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

---

## Категории агентов

| Категория | Количество | Примеры |
|-----------|------------|---------|
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

---

## Технологический стек

| Компонент | Технология |
|-----------|-----------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

---

## Философия

```
hooks are sensors. observe, filter, signal.
agents are muscles. build, produce, fix.
the bridge between them: context injection.
no direct RPC. no message passing. by design.
implicit coordination through context.
```

Хуки -- это сенсоры. Наблюдают, фильтруют, сигнализируют.
Агенты -- это мышцы. Строят, производят, чинят.
Мост между ними: инъекция контекста.
Никакого прямого RPC. Никакого обмена сообщениями. Так задумано.
Неявная координация через контекст.

---

## License

MIT

---

<div align="center">

**Built by [@vibeeval](https://x.com/vibeeval)**

Без собственной модели. Без собственного API. Только хорошая инженерия.

</div>
