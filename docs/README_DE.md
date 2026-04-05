[← Back to English](../README.md)

<div align="center">

# vibecosystem

**KI-Softwareteam auf Basis von Claude Code.**

139 Agents. 279 skills. 60 hooks. Null manuelle Arbeit.

<img src="../assets/gif1-numbers.gif" alt="Ecosystem Numbers" width="700">

</div>

---

## Auf einen Blick

| Kennzahl | Anzahl |
|----------|--------|
| Agents | **137** |
| Skills | **279** |
| Hooks | **53** |
| Rules | **22** |
| Manuelle Arbeit | **0** |

---

## Was ist das?

vibecosystem verwandelt Claude Code in ein vollstaendiges KI-Softwareteam. Kein einzelner Assistent -- ein **Team** aus 136 spezialisierten Agents, die planen, entwickeln, reviewen, testen und aus jedem Fehler lernen.

Kein eigenes Modell. Keine eigene API. Nur das Hook- + Agent- + Rules-System von Claude Code, bis ans Limit ausgereizt.

### Das grosse Bild

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

---

## Kernfunktionen

### 1. Self-Learning Pipeline

Jeder Fehler wird zu einer Regel. Automatisch.

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

Kein manueller Eingriff. Das System schreibt seine eigenen Regeln.

### 2. Agent Swarm

Sag "fuege ein neues Feature hinzu" und ueber 20 Agents werden in 5 Phasen aktiv.

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. Adaptives Hook-Loading

60 hooks existieren, aber sie laufen nicht alle gleichzeitig. Die Absicht bestimmt, welche Hooks ausgeloest werden.

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

Jede Aufgabe durchlaeuft ein Quality Gate:

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

Wenn ein Agent einen Fehler macht, lernt das gesamte Team daraus.

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

Routing-Tabelle mit 74 Zeilen: Jeder Aufgabentyp wird dem richtigen Agent zugeordnet.

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

---

## Architektur

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

---

## Agent-Kategorien

| Kategorie | Anzahl | Beispiele |
|-----------|--------|-----------|
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

## Technologie-Stack

| Komponente | Technologie |
|------------|------------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

---

## Philosophie

```
hooks are sensors. observe, filter, signal.
agents are muscles. build, produce, fix.
the bridge between them: context injection.
no direct RPC. no message passing. by design.
implicit coordination through context.
```

Hooks sind Sensoren. Sie beobachten, filtern, signalisieren.
Agents sind Muskeln. Sie bauen, produzieren, reparieren.
Die Bruecke dazwischen: Context Injection.
Kein direktes RPC. Kein Message Passing. Bewusst so gewaehlt.
Implizite Koordination ueber den Kontext.

---

## License

MIT

---

<div align="center">

**Built by [@vibeeval](https://x.com/vibeeval)**

Kein eigenes Modell. Keine eigene API. Nur gutes Engineering.

</div>
