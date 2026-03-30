---
name: plan-documentation
description: Structured plan file generation for large tasks -- phased planning, completion tracking, and decision documentation
---

# Plan Documentation

Generate structured plan files when starting large features, refactoring efforts, or multi-phase work. Plans create a paper trail that survives context resets and helps collaborators understand what was planned, what changed, and why.

## When to Generate Plan Files

Create a plan document when:
- The task spans more than 2 files or requires multiple coordinated changes
- Work will take more than one session or phase
- Multiple approaches exist and the chosen path should be documented
- Other people (or future you) need to understand the sequence of work

Do NOT create plan files for:
- Single-file fixes or tweaks
- Routine maintenance (dependency updates, formatting)
- Tasks that can be completed in under 15 minutes

## Plan Document Template

Create the plan at `plans/<task-slug>-plan.md` in the project root.

```markdown
# Plan: <Task Title>

Created: <ISO date>
Status: IN_PROGRESS | COMPLETE | ABANDONED

## Summary

<2-3 sentences explaining what this work accomplishes and why it matters.>

## Phases

### Phase 1: <Phase Title>
- [ ] Step 1 description
- [ ] Step 2 description
- [ ] Step 3 description

**Acceptance Criteria:**
- <What must be true when this phase is done>
- <Measurable or verifiable condition>

### Phase 2: <Phase Title>
- [ ] Step 1 description
- [ ] Step 2 description

**Acceptance Criteria:**
- <Condition>

### Phase N: <Phase Title>
...

## Open Questions

1. <Question about approach or requirement> -- Suggested: <Option A> vs <Option B>
2. <Question about scope> -- Suggested: <Option A> vs <Option B>
3. <Question about dependency or risk> -- Suggested: <Option A>

Keep open questions between 1-5. Each should have suggested options so they can be resolved quickly. Remove questions as they get answered -- move the decision to the relevant phase.

## Dependencies

- <External system, API, library, or team dependency>
- <Prerequisite work that must finish first>

## Risks

- <What could go wrong and how likely it is>
- <Mitigation strategy if applicable>
```

## Phase Completion Template

After finishing each phase, create `plans/<task-slug>-phase-N-complete.md`:

```markdown
# Phase N Complete: <Phase Title>

Completed: <ISO date>
Plan: <task-slug>-plan.md

## Phase N Summary

<1-2 sentences on what was accomplished.>

## What Changed

| File | Change |
|------|--------|
| `path/to/file.ts` | Added validation logic for user input |
| `path/to/test.ts` | 6 new unit tests for validation edge cases |

## What Was Tested

- <Test suite or manual verification performed>
- <Edge cases covered>
- <What was NOT tested and why>

## Decisions Made

- <Decision>: <Why this option was chosen over alternatives>

## Next Phase Preview

Phase N+1 will focus on <brief description>. Prerequisites met: <yes/no>.
```

## Final Completion Template

When all phases are done, create `plans/<task-slug>-complete.md`:

```markdown
# Complete: <Task Title>

Completed: <ISO date>
Plan: <task-slug>-plan.md
Duration: <how long the work took>

## Task Summary

<2-3 sentences on the full scope of work completed.>

## All Phases

| Phase | Title | Status |
|-------|-------|--------|
| 1 | <Title> | COMPLETE |
| 2 | <Title> | COMPLETE |
| N | <Title> | COMPLETE |

## Total Changes

- Files modified: <count>
- Files created: <count>
- Tests added: <count>
- Lines changed: <approximate>

## Lessons Learned

- <Insight that would help someone doing similar work>
- <Unexpected challenge and how it was resolved>
- <Pattern discovered that should be reused>
```

## File Naming Convention

All plan files go in the `plans/` directory at the project root.

| File | Purpose |
|------|---------|
| `<task-slug>-plan.md` | Initial plan with phases and acceptance criteria |
| `<task-slug>-phase-N-complete.md` | Completion record for phase N |
| `<task-slug>-complete.md` | Final completion summary |

The `<task-slug>` should be a short, lowercase, hyphenated description of the task (e.g., `auth-refactor`, `search-api-v2`, `dashboard-redesign`).

## Rules

- Write the plan BEFORE starting implementation
- Update phase status in the plan file as work progresses
- Do not skip phase completion docs -- they are the audit trail
- Keep summaries concise -- if it takes more than 3 sentences, it is too long
- Open questions should block work until resolved, not be ignored
- If the plan changes significantly mid-work, update the plan file and note what changed and why
