[← Back to English](../README.md)

<div align="center">

# vibecosystem

**Equipe logicielle IA construite sur Claude Code.**

121 agents. 223 skills. 49 hooks. Zero intervention manuelle.

<img src="../assets/gif1-numbers.gif" alt="Ecosystem Numbers" width="700">

</div>

---

## En un coup d'oeil

| Metrique | Nombre |
|----------|--------|
| Agents | **121** |
| Skills | **223** |
| Hooks | **49** |
| Rules | **21** |
| Travail manuel | **0** |

---

## C'est quoi ?

vibecosystem transforme Claude Code en une veritable equipe logicielle IA. Pas un simple assistant -- une **equipe** de 121 agents specialises qui planifient, construisent, revisent, testent et apprennent de chaque erreur.

Pas de modele personnalise. Pas d'API personnalisee. Juste le systeme de hooks + agents + rules de Claude Code, pousse a ses limites.

### Vue d'ensemble

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

---

## Fonctionnalites principales

### 1. Pipeline d'auto-apprentissage

Chaque erreur devient une regle. Automatiquement.

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

Aucune intervention manuelle. Le systeme ecrit ses propres regles.

### 2. Agent Swarm

Dites "ajoute une nouvelle fonctionnalite" et plus de 20 agents s'activent en 5 phases.

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. Chargement adaptatif des hooks

49 hooks existent, mais ils ne s'executent pas tous en meme temps. L'intention determine quels hooks se declenchent.

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

Chaque tache passe par une porte de qualite :

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

Quand un agent fait une erreur, toute l'equipe en tire la lecon.

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

Table de routage de 74 lignes : chaque type de tache est dirige vers le bon agent.

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

---

## Architecture

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

---

## Categories d'agents

| Categorie | Nombre | Exemples |
|-----------|--------|----------|
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

---

## Stack technique

| Composant | Technologie |
|-----------|------------|
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

Les hooks sont des capteurs. Ils observent, filtrent, signalent.
Les agents sont des muscles. Ils construisent, produisent, reparent.
Le pont entre eux : l'injection de contexte.
Pas de RPC direct. Pas d'echange de messages. C'est voulu.
Coordination implicite a travers le contexte.

---

## License

MIT

---

<div align="center">

**Built by [@vibeeval](https://x.com/vibeeval)**

Pas de modele personnalise. Pas d'API personnalisee. Juste du bon engineering.

</div>
