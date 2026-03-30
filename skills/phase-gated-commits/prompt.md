---
name: phase-gated-commits
description: Phase-gated commit workflow for clean git history -- implement, review, test, commit per phase
---

# Phase-Gated Commits

Break large features and refactoring into discrete phases. Each phase follows a strict implement -> review -> test -> commit cycle. The result is a clean, bisectable git history where every commit represents a working state.

## When to Use

- Multi-file features where changes span 3+ files
- Refactoring that touches shared code used by many modules
- Any work where you want the ability to revert one phase without losing others
- Migrations or upgrades that should be applied incrementally

## When NOT to Use

- Single-file changes or small fixes
- Exploratory work where the final shape is unknown
- Prototyping where speed matters more than history

## Phase Structure

Break the work into 2-5 phases. Each phase should:
- Be independently functional (the codebase works after each commit)
- Have a clear scope (you can describe it in one sentence)
- Be reviewable in isolation (a reviewer can understand the diff without needing other phases)

### Phase Sizing

| Phase Size | Guideline |
|-----------|-----------|
| Too small | Renaming a single variable is not a phase |
| Right size | Add the data model + migration + basic tests |
| Too large | Implement entire feature end-to-end in one phase |

Aim for phases that touch 2-8 files each. If a phase touches more than 10 files, consider splitting it further.

## Workflow Per Phase

```
Phase N:
  1. IMPLEMENT -- Write the code for this phase only
  2. REVIEW    -- Self-review the diff, check for issues
  3. TEST      -- Run tests, verify nothing is broken
  4. COMMIT    -- Create a single commit for this phase
  5. PAUSE     -- Wait for user confirmation before Phase N+1
```

### Step 1: Implement

Write only the code that belongs to this phase. Do not reach ahead into the next phase. If you realize the current phase needs to be larger, stop and re-scope before continuing.

### Step 2: Review

Review your own diff before committing:
- Are there debug statements or commented-out code?
- Does the code follow existing patterns in the codebase?
- Are there any security concerns (hardcoded values, missing validation)?
- Is the change minimal -- nothing extra included?

If review finds issues, fix them within the same phase. Do not defer fixes to a later phase.

### Step 3: Test

Run the project test suite. At minimum:
- Existing tests must still pass (no regressions)
- New code should have tests if the codebase has test coverage
- If tests fail, fix within the current phase

### Step 4: Commit

Create one commit per phase with a descriptive message.

**Commit message format:**

```
feat(phase N/M): <description of what this phase accomplishes>

<Optional body explaining WHY this phase exists as a separate unit>
```

Examples:
```
feat(phase 1/3): add user preference data model and migration

Separate from the API layer so the schema can be reviewed independently.

feat(phase 2/3): implement preference API endpoints with validation

Builds on the data model from phase 1. Includes input validation
with zod schemas and error handling for all edge cases.

feat(phase 3/3): add preference UI components and integration tests

Connects the API to the frontend. Integration tests cover the
full create/read/update flow.
```

### Step 5: Pause

After committing, pause and confirm with the user before starting the next phase. This gives the user a chance to:
- Review what was committed
- Adjust the plan for remaining phases
- Stop early if the work so far is sufficient

## Rules

1. **One commit per phase.** Do not batch multiple phases into one commit or split one phase into multiple commits.
2. **No forward references.** Phase N should not depend on code that will be written in Phase N+1. Each commit must leave the codebase in a working state.
3. **Fix before advancing.** If review or tests reveal a problem, resolve it in the current phase. Never push a known issue to the next phase.
4. **Phases are sequential.** Do not start Phase N+1 until Phase N is committed. This ensures each phase builds on a verified foundation.
5. **Re-scope when needed.** If mid-implementation you realize the phase breakdown is wrong, stop, revise the plan, and communicate the change. Do not silently merge phases.
6. **Keep phases balanced.** Avoid one giant phase followed by tiny cleanup phases. Redistribute work so each phase carries meaningful weight.

## Integration with Plan Documentation

When using this skill alongside `plan-documentation`:
- Each phase in the plan maps to one phase-gated commit
- Phase completion docs (`<task>-phase-N-complete.md`) are written after the commit
- The plan file phase status is updated after each commit
