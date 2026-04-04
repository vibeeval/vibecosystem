[← Back to English](../README.md)

<div align="center">

# vibecosystem

**Team software IA costruito su Claude Code.**

138 agents. 271 skills. 60 hooks. Zero lavoro manuale.

<img src="../assets/gif1-numbers.gif" alt="Ecosystem Numbers" width="700">

</div>

---

## A colpo d'occhio

| Metrica | Quantita |
|---------|----------|
| Agents | **137** |
| Skills | **269** |
| Hooks | **53** |
| Rules | **22** |
| Lavoro manuale | **0** |

---

## Cos'e?

vibecosystem trasforma Claude Code in un team software IA completo. Non un semplice assistente -- un **team** di 138 agenti specializzati che pianificano, costruiscono, revisionano, testano e imparano da ogni errore.

Nessun modello personalizzato. Nessuna API personalizzata. Solo il sistema di hooks + agents + rules di Claude Code, spinto al massimo.

### Il quadro generale

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

---

## Funzionalita principali

### 1. Pipeline di autoapprendimento

Ogni errore diventa una regola. Automaticamente.

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

Nessun intervento manuale. Il sistema scrive le proprie regole.

### 2. Agent Swarm

Di' "aggiungi una nuova funzionalita" e piu di 20 agenti si attivano in 5 fasi.

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. Caricamento adattivo degli hook

Esistono 60 hook, ma non vengono eseguiti tutti contemporaneamente. L'intento determina quali hook si attivano.

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

Ogni task passa attraverso un quality gate:

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

Quando un agente commette un errore, l'intero team impara da esso.

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

Tabella di routing con 74 righe: ogni tipo di task viene indirizzato all'agente giusto.

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

---

## Architettura

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

## Categorie di agenti

| Categoria | Quantita | Esempi |
|-----------|----------|--------|
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

## Stack tecnologico

| Componente | Tecnologia |
|------------|-----------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

---

## Filosofia

```
hooks are sensors. observe, filter, signal.
agents are muscles. build, produce, fix.
the bridge between them: context injection.
no direct RPC. no message passing. by design.
implicit coordination through context.
```

Gli hook sono sensori. Osservano, filtrano, segnalano.
Gli agenti sono muscoli. Costruiscono, producono, riparano.
Il ponte tra loro: context injection.
Nessun RPC diretto. Nessuno scambio di messaggi. Per scelta progettuale.
Coordinamento implicito attraverso il contesto.

---

## License

MIT

---

<div align="center">

**Built by [@vibeeval](https://x.com/vibeeval)**

Nessun modello personalizzato. Nessuna API personalizzata. Solo buona ingegneria.

</div>
