[← Back to English](../README.md)

# vibecosystem

**فريق برمجيات ذكاء اصطناعي مبني على Claude Code.**

139 Agent. 279 skill. 60 hook. بدون أي عمل يدوي.

## نظرة سريعة

| المقياس | العدد |
|--------|-------|
| Agents | **137** |
| Skills | **279** |
| Hooks | **53** |
| Rules | **22** |
| العمل اليدوي | **0** |

## ما هذا؟

يحول vibecosystem أداة Claude Code إلى فريق برمجيات ذكاء اصطناعي متكامل. ليس مساعدا واحدا، بل **فريق** من 139 agent متخصصا يخطط ويبني ويراجع ويختبر ويتعلم من كل خطأ.

لا نموذج مخصص. لا واجهة برمجة مخصصة. فقط نظام hook + agent + rules في Claude Code، مستغل حتى أقصى حد.

### الصورة الكاملة

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

## الميزات الأساسية

### 1. خط أنابيب التعلم الذاتي

كل خطأ يتحول تلقائيا إلى قاعدة.

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

لا حاجة لتدخل يدوي. النظام يكتب قواعده بنفسه.

### 2. Agent Swarm

قل "أضف ميزة جديدة" وسيتم تنشيط أكثر من 20 agent عبر 5 مراحل.

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. التحميل التكيفي للـ Hook

يوجد 60 hook لكنها لا تعمل جميعها في آن واحد. نية المستخدم هي التي تحدد أي hook يتم تشغيله.

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

كل مهمة تمر عبر بوابة جودة:

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

عندما يخطئ agent واحد، يتعلم الفريق بأكمله من هذا الخطأ.

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

جدول توجيه من 74 صفا: كل نوع مهمة يُوجّه إلى الـ agent المناسب.

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

## البنية المعمارية

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Hooks   │  │  Agents  │  │  Skills  │              │
│  │  (53)    │→ │  (139)   │← │  (279)   │              │
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

## فئات الـ Agent

| الفئة | العدد | أمثلة |
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

## المكدس التقني

| المكون | التقنية |
|-----------|-----------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

## الفلسفة

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

لا نموذج مخصص. لا واجهة برمجة مخصصة. فقط هندسة برمجيات متقنة.

</div>
