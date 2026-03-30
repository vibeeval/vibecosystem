[← Back to English](../README.md)

# vibecosystem

**Claude Code पर बनी AI सॉफ्टवेयर टीम।**

137 Agent। 269 skill। 53 hook। शून्य मैनुअल काम।

## एक नज़र में

| मापदंड | संख्या |
|--------|-------|
| Agents | **137** |
| Skills | **269** |
| Hooks | **53** |
| Rules | **22** |
| मैनुअल काम | **0** |

## यह क्या है?

vibecosystem Claude Code को एक पूर्ण AI सॉफ्टवेयर टीम में बदल देता है। यह कोई अकेला असिस्टेंट नहीं है -- यह 136 विशेषज्ञ agent की एक **टीम** है जो योजना बनाती है, निर्माण करती है, रिव्यू करती है, टेस्ट करती है, और हर गलती से सीखती है।

कोई कस्टम मॉडल नहीं। कोई कस्टम API नहीं। बस Claude Code का hook + agent + rules सिस्टम, अपनी पूरी क्षमता तक इस्तेमाल किया गया।

### बड़ी तस्वीर

<img src="../assets/gif5-bigpicture.gif" alt="Big Picture" width="700">

## मुख्य विशेषताएं

### 1. सेल्फ-लर्निंग पाइपलाइन

हर एरर अपने आप एक नियम बन जाता है।

<img src="../assets/gif2-pipeline.gif" alt="Self-Learning Pipeline" width="700">

```
Error happens → passive-learner captures pattern
→ consolidator groups & counts
→ confidence >= 5 → auto-inject into context
→ 10x repeat → permanent .md rule file
```

किसी मैनुअल हस्तक्षेप की ज़रूरत नहीं। सिस्टम अपने नियम खुद लिखता है।

### 2. Agent Swarm

बस कहें "एक नया फीचर जोड़ो" और 20 से ज़्यादा agent 5 चरणों में सक्रिय हो जाते हैं।

<img src="../assets/gif3-swarm.gif" alt="Agent Swarm" width="700">

```
Phase 1 (Discovery):    scout + architect + project-manager
Phase 2 (Development):  backend-dev + frontend-dev + devops + specialists
Phase 3 (Review):       code-reviewer + security-reviewer + qa-engineer
Phase 4 (QA Loop):      verifier + tdd-guide (max 3 retry → escalate)
Phase 5 (Final):        self-learner + technical-writer
```

### 3. एडैप्टिव Hook लोडिंग

53 hook मौजूद हैं लेकिन सभी एक साथ नहीं चलते। उपयोगकर्ता की मंशा तय करती है कि कौन से hook सक्रिय होंगे।

<img src="../assets/gif4-hooks.gif" alt="Adaptive Hooks" width="700">

```
"fix the bug"      → compiler-in-loop + error-broadcast     ~2,400 tok
"add api endpoint"  → edit-context + signature-helper + arch  ~3,100 tok
"explain this code" → (nothing)                               ~800 tok
```

### 4. Dev-QA Loop

हर टास्क एक क्वालिटी गेट से गुज़रता है:

```
Developer implements → code-reviewer + verifier check
→ PASS → next task
→ FAIL → feedback to developer, retry (max 3)
→ 3x FAIL → escalate (reassign / decompose / defer)
```

### 5. Canavar Cross-Training

जब एक agent गलती करता है, तो पूरी टीम उससे सीखती है।

```
Agent error → error-ledger.jsonl → skill-matrix.json
→ All agents get the lesson at session start
→ Team-wide error prevention
```

### 6. Assignment Matrix

74 पंक्तियों की राउटिंग टेबल: हर टास्क टाइप सही agent से जुड़ता है।

```
GraphQL API      → graphql-expert  (backup: backend-dev)
Kubernetes       → kubernetes-expert (backup: devops)
DDD modeling     → ddd-expert      (backup: architect)
Bug reproduction → replay          (backup: sleuth)
... 70 more rows
```

## आर्किटेक्चर

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

## Agent श्रेणियां

| श्रेणी | संख्या | उदाहरण |
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

## टेक स्टैक

| घटक | तकनीक |
|-----------|-----------|
| Runtime | Claude Code (Claude Max) |
| Models | Opus 4.6 / Sonnet 4.6 |
| Hook engine | TypeScript → esbuild → .mjs |
| Memory DB | PostgreSQL + pgvector (Docker) |
| Agent format | Markdown + YAML frontmatter |
| Skill format | prompt.md / SKILL.md |
| Cross-training | JSONL ledger + JSON skill matrix |

## दर्शन

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

कोई कस्टम मॉडल नहीं। कोई कस्टम API नहीं। बस बेहतरीन इंजीनियरिंग।

</div>
