---
name: smart-model-routing
description: Dynamic model selection based on task complexity scoring. Replaces static model mappings with a weighted signal system that picks Opus, Sonnet, or Haiku-class speed per task. Works with agent-assignment-matrix.md.
---

# Smart Model Routing

Dynamic model selection based on task complexity. Never use a sledgehammer where a scalpel will do — and never use a scalpel where you need a sledgehammer.

## Core Philosophy

Static model assignments ("always use Sonnet for code") waste money on trivial tasks and produce poor results on complex ones. This skill scores every task across three signal categories and routes it to the appropriate model tier automatically.

**Default rule: inherit parent model.** Only override when the score clearly warrants a different tier. Never specify a model without a scoring reason.

---

## Signal Categories

Three weighted categories are evaluated. Their scores combine into a single complexity score (0-20 typical range, can exceed).

### Category 1: Lexical Signals (weight: 0.3)

Analyze the raw text of the request.

#### Architecture Keywords (+3 each)
Trigger words that indicate high-stakes design work:
- "redesign", "overhaul", "new system", "migrate", "refactor entire", "rewrite"
- "architecture", "from scratch", "greenfield", "new service", "platform"

Example: "Redesign the authentication system" → +3

#### Risk Keywords (+2 each)
Domains where mistakes are expensive or irreversible:
- "production", "security", "auth", "authentication", "authorization"
- "payment", "billing", "database migration", "data loss", "rollback"
- "GDPR", "compliance", "PII", "encryption", "secrets", "credentials"

Example: "Update the payment processing logic" → +2

#### Simple Keywords (-2 each)
Signals the task is mechanical and bounded:
- "fix typo", "update text", "rename", "add comment", "change color"
- "update label", "fix spacing", "update copy", "minor tweak"

Example: "Fix the typo in the header" → -2

#### Question Depth (+1 per layer of constraint)
Count nested conditions, multiple constraints, OR clauses:
- Single direct question → 0
- "...but also consider X" → +1
- "...and it must handle Y, while also supporting Z" → +2

#### Word Count Thresholds
- Under 20 words → -1 (terse request, likely simple)
- Over 200 words → +1 (detailed spec, likely complex)
- Over 500 words → +2 (full brief, high complexity expected)

---

### Category 2: Structural Signals (weight: 0.4)

Analyze the task structure, not just the words.

#### Subtask Count
How many discrete steps or deliverables?
- 1 subtask → 0
- 2-3 subtasks → +1
- 4-6 subtasks → +2
- 7 or more → +3

Example: "Build an endpoint, write tests, add validation, update docs, add migration, hook up auth, notify the frontend team" → +3

#### Cross-File Dependencies
How many files will be touched?
- 1 file → 0
- 2-3 files → +1
- 4 or more files → +2

Use `tldr impact <function>` or `tldr calls .` to estimate before scoring.

#### Impact Scope
Where in the system does this change land?
- Function-level change → 0
- Module or feature boundary → +1
- System-wide, cross-cutting concern → +3

Examples:
- "Update the formatDate helper" → 0
- "Refactor the notification module" → +1
- "Change how auth tokens are validated across all routes" → +3

#### Reversibility
Can this be easily undone?
- Easily reversible (toggle a flag, revert a file) → 0
- Hard to undo (DB migration, data transform, breaking API change) → +2

#### Test Requirement
What level of test coverage is needed?
- No new tests required → 0
- Extend existing tests → +1
- Write a new test suite from scratch → +2

---

### Category 3: Context Signals (weight: 0.3)

The situation around the request, not just the request itself.

#### Previous Errors in Session
Has this task or related area already failed once?
- 0 errors so far → 0
- 1-2 prior failures on this task → +1
- 3 or more failures → +2

Rationale: repeated failures indicate the problem is genuinely hard. Escalate.

#### Agent Chain Depth
Is this a top-level user request or the 3rd handoff in a chain?
- Direct request → 0
- 2 agents deep → +1
- 3 or more agents deep → +2

Deep chains accumulate complexity. Each layer adds ambiguity risk.

#### Codebase Familiarity
Is this a well-trodden path or new territory?
- Known patterns, familiar framework → 0
- New-to-session framework, unfamiliar library → +2
- Undocumented legacy code, no tests exist → +3

---

## Tier Thresholds

After computing the weighted sum:

```
raw_score = (lexical_raw * 0.3) + (structural_raw * 0.4) + (context_raw * 0.3)
```

| Score | Tier | Model | Use Case |
|-------|------|-------|----------|
| >= 8 | HIGH | Opus | System design, security, complex debugging, migration planning |
| >= 4 | MEDIUM | Sonnet | Standard development, feature work, code review |
| < 4 | LOW | Haiku-class speed | Typo fixes, label changes, simple renames, formatting |

---

## Confidence Calculation

Score proximity to a threshold boundary determines confidence.

| Distance from nearest threshold | Confidence | Action |
|----------------------------------|-----------|--------|
| Score within 1 point of boundary | LOW | Escalate to higher tier |
| Score 2+ points from boundary | HIGH | Use computed tier |

### Escalation on Low Confidence

When confidence is LOW, always round up to the higher tier. A false negative (using a weak model on a hard task) is far more costly than a false positive (using a strong model on an easy task).

Example:
- Score = 7.2, threshold for HIGH = 8 → Distance = 0.8 → LOW confidence → use Opus anyway
- Score = 5.8, threshold for MEDIUM = 4 → Distance = 1.8 → LOW confidence → use Sonnet (already in medium, no escalation needed)
- Score = 3.1, threshold for LOW = 4 → Distance = 0.9 → LOW confidence → use Sonnet (escalate from Haiku)

---

## Hard Rules (Override Score)

These override the scoring system completely. No exceptions.

### Never Use Haiku For:
- Security reviews of any kind
- Authentication or authorization logic
- Architectural or design decisions
- Any task touching payment, billing, or financial data
- Multi-file refactoring (4+ files)
- Database migrations
- Unfamiliar codebases without existing tests

### Always Use Opus For:
- System design from scratch
- Complex multi-step debugging with no clear root cause
- Migration planning (major version upgrades, framework migrations)
- Security audit of critical paths
- When 2+ prior attempts have failed on the same task
- Agent chains 3+ deep on a non-trivial task

---

## Application Rules

### For Agent Spawns
When spawning sub-agents, include model selection in the spawn parameters only when the score warrants it. Omit `model` entirely when the task should inherit.

```typescript
// CORRECT: score = 9 (HIGH) → specify Opus
Task({
  prompt: "Design the new event sourcing architecture...",
  model: "claude-opus-4-5"
})

// CORRECT: score = 5 (MEDIUM) → inherit, omit model
Task({
  prompt: "Add input validation to the create endpoint..."
  // no model param
})

// WRONG: always specifying model
Task({
  prompt: "Fix the typo in the README",
  model: "claude-opus-4-5"  // wasteful
})
```

### For Inline Decisions
When deciding which model to use for your own reasoning:
- If score >= 8 and you are not already on Opus: note the gap and do your best
- If score < 4: do not overthink, execute directly

---

## Scoring Examples

### Example 1: Trivial Fix
Request: "Change the button text from 'Submit' to 'Save'"

| Signal | Value | Score |
|--------|-------|-------|
| Lexical: simple keyword ("change") | -2 | |
| Lexical: word count (7 words) | -1 | |
| Structural: 1 file, 1 subtask, function-level, reversible, no tests | 0 | |
| Context: no errors, direct request, familiar codebase | 0 | |
| Weighted total | | 0.9 (LOW) |

Tier: LOW. Model: Haiku-class. Confidence: HIGH.

---

### Example 2: New Feature Endpoint
Request: "Add a POST /api/orders endpoint with Zod validation, rate limiting, auth middleware, and write integration tests"

| Signal | Value | Score |
|--------|-------|-------|
| Lexical: no arch keywords, no risk keywords | 0 | |
| Lexical: word count ~20 | 0 | |
| Structural: 4 subtasks (+2), 3-4 files (+1), module-level (+1), reversible (0), new tests (+2) | 6 | |
| Context: no prior errors, direct, familiar | 0 | |
| Weighted total | | (0 * 0.3) + (6 * 0.4) + (0 * 0.3) = 2.4 → LOW |

Wait — re-check: "auth middleware" is a risk keyword (+2 lexical). Update:

| Signal | Value | Score |
|--------|-------|-------|
| Lexical: risk keyword "auth" (+2) | 2 | |
| Structural: 6 signals total | 6 | |
| Context: 0 | 0 | |
| Weighted total | | (2 * 0.3) + (6 * 0.4) + (0 * 0.3) = 3.0 → LOW, but hard rule: auth → override to MEDIUM |

Tier: MEDIUM. Model: Sonnet. Hard rule override applied.

---

### Example 3: Security Audit
Request: "Audit the authentication flow. We've had two incidents this week where tokens weren't being validated correctly in production. Find root cause and fix."

| Signal | Value | Score |
|--------|-------|-------|
| Lexical: risk keywords "authentication", "tokens", "production" (+2 +2 +2) | 6 | |
| Lexical: question depth (find root cause AND fix, two constraints) | +2 | |
| Lexical: word count 36 | 0 | |
| Structural: unknown subtask count (investigation = open-ended) → treat as 4+ (+2), 3+ files (+2), system-wide (+3), hard to reverse (+2) | 9 | |
| Context: 2 prior production incidents = treat as 2 errors (+1), direct request (0), known codebase (0) | 1 | |
| Weighted total | | (8 * 0.3) + (9 * 0.4) + (1 * 0.3) = 2.4 + 3.6 + 0.3 = 6.3 → MEDIUM |

But: hard rule "security review of any kind" AND "2+ prior failures" → override to HIGH.

Tier: HIGH. Model: Opus. Hard rule override applied (security + repeated failures).

---

### Example 4: Database Migration
Request: "Migrate the users table to add a composite index on (email, tenant_id), backfill existing rows, and update all queries that touch this table"

| Signal | Value | Score |
|--------|-------|-------|
| Lexical: risk keywords "database migration" (+2) | 2 | |
| Lexical: word count 30 | 0 | |
| Structural: 3 subtasks (+1), 4+ files (+2), system-wide (+3), irreversible (+2), new tests for migration (+2) | 10 | |
| Context: no errors yet, direct, familiar | 0 | |
| Weighted total | | (2 * 0.3) + (10 * 0.4) + (0 * 0.3) = 0.6 + 4.0 + 0 = 4.6 → MEDIUM |

But: hard rule "database migration" → override to HIGH.

Tier: HIGH. Model: Opus. Score near boundary + hard rule.

---

## Decision Log Format

Every routing decision must be logged:

```
ROUTING DECISION
  TASK: [brief description]
  SCORE: [weighted total] (lexical=[X], structural=[Y], context=[Z])
  TIER: [LOW|MEDIUM|HIGH]
  CONFIDENCE: [HIGH|LOW]
  HARD_RULE: [rule name if override applied, else "none"]
  MODEL: [selected model]
  REASON: [1-sentence justification]
```

Example:
```
ROUTING DECISION
  TASK: Security audit of auth token validation
  SCORE: 6.3 (lexical=8, structural=9, context=1)
  TIER: HIGH (override from MEDIUM)
  CONFIDENCE: HIGH
  HARD_RULE: security-review + repeated-failures
  MODEL: claude-opus-4-5
  REASON: Active production security incident with two prior failures; hard rule override applied
```

---

## Integration with vibecosystem

### Agent Assignment Matrix
This skill overrides the default model assignments in `agent-assignment-matrix.md` when a scoring reason exists. The matrix defines WHICH agent handles a task; this skill defines WHICH MODEL that agent uses.

Priority order:
1. Hard rules (override everything)
2. Confidence-based escalation
3. Computed tier
4. Agent matrix default
5. Parent model inheritance (fallback)

### QA Loop Integration
When a task enters its second or third retry in the `qa-loop.md` Dev-QA cycle:
- Add +1 to context signals for each prior failure
- Re-score the task
- If tier escalates, upgrade model for the retry

This prevents the failure loop of using the same weak model repeatedly on a hard task.

### Memory Recall
Before scoring, check if a similar task has been attempted before:
```bash
cd ~/.claude && PYTHONPATH=scripts python3 scripts/core/recall_learnings.py \
  --query "model routing [task description]" --text-only
```

If a prior attempt used a different tier and succeeded or failed, factor that into the context signal score.

---

## Anti-patterns

| Anti-pattern | Why It Fails | Correct Behavior |
|---|---|---|
| Always specifying Opus "to be safe" | Slow, expensive, no learning signal | Score the task, use the right tier |
| Always inheriting parent model | Complex sub-tasks get wrong model | Score independently, override when needed |
| Using model as a retry strategy | Same model will fail the same way | If score warrants higher tier, upgrade |
| Ignoring hard rules | Security bugs, data loss | Hard rules exist because the cost of failure is asymmetric |
| Scoring once per session | Context changes, errors accumulate | Re-score on retry, re-score when context shifts |

---

## Checklist

Before routing any agent spawn or model selection decision:

- [ ] Evaluated all three signal categories
- [ ] Applied weights (0.3 / 0.4 / 0.3)
- [ ] Checked distance from threshold boundary
- [ ] Checked all hard rules
- [ ] Logged the decision (TASK, SCORE, TIER, CONFIDENCE, HARD_RULE, MODEL, REASON)
- [ ] Omitted `model` param if inheriting from parent

**Remember**: The goal is the right model for the job. Not the most expensive one. Not the default one. The right one.
