[← Back to English](../README.md)

<div align="center">

# vibecosystem

**AI-softwareteam gebouwd op Claude Code.**

136 agents. 253 skills. 53 hooks. Nul handmatig werk.

<img src="../assets/gif1-numbers.gif" alt="Ecosystem Numbers" width="700">

</div>

---

## In een oogopslag

| Metriek | Aantal |
|---------|--------|
| Agents | **136** |
| Skills | **253** |
| Hooks | **53** |
| Rules | **21** |
| Handmatig werk | **0** |

---

## Wat is dit?

vibecosystem maakt van Claude Code een compleet AI-softwareteam. Geen enkele assistent -- een **team** van 136 gespecialiseerde agents die plannen, bouwen, reviewen, testen en leren van elke fout.

Geen eigen model. Geen eigen API. Alleen het hook- + agent- + rules-systeem van Claude Code, tot het uiterste benut.

### Het grote plaatje

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

---

## Kernfunctionaliteiten

### 1. Zelflerende pipeline

Elke fout wordt een regel. Automatisch.

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

Geen handmatige tussenkomst. Het systeem schrijft zijn eigen regels.

### 2. Agent Swarm

Zeg "voeg een nieuwe feature toe" en meer dan 20 agents worden actief in 5 fasen.

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. Adaptief laden van hooks

Er bestaan 53 hooks, maar ze draaien niet allemaal tegelijk. De intentie bepaalt welke hooks worden geactiveerd.

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

Elke taak doorloopt een kwaliteitspoort:

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

Wanneer een agent een fout maakt, leert het hele team ervan.

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

Routeringstabel met 74 rijen: elk taaktype wordt naar de juiste agent geleid.

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

---

## Architectuur

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Hooks   │  │  Agents  │  │  Skills  │              │
│  │  (53)    │→ │  (136)   │← │  (253)   │              │
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

---

## Agentcategorieen

| Categorie | Aantal | Voorbeelden |
|-----------|--------|-------------|
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

## Technologiestack

| Component | Technologie |
|-----------|------------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

---

## Filosofie

```
hooks are sensors. observe, filter, signal.
agents are muscles. build, produce, fix.
the bridge between them: context injection.
no direct RPC. no message passing. by design.
implicit coordination through context.
```

Hooks zijn sensoren. Ze observeren, filteren, signaleren.
Agents zijn spieren. Ze bouwen, produceren, repareren.
De brug ertussen: context-injectie.
Geen directe RPC. Geen berichtenuitwisseling. Bewust zo ontworpen.
Impliciete coordinatie via context.

---

## License

MIT

---

<div align="center">

**Built by [@vibeeval](https://x.com/vibeeval)**

Geen eigen model. Geen eigen API. Gewoon goed vakmanschap.

</div>
