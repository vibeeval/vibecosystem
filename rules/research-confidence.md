# Research Confidence Threshold

When investigating a codebase, reading documentation, or exploring unfamiliar code, apply a confidence threshold to decide when to stop researching and start working.

## The 90% Rule

Stop researching at 90% confidence. 90% means you can answer all four of these questions:

1. **What files are relevant** -- You know which files you need to read or modify
2. **How existing code works** -- You understand the control flow and data flow in the area you are changing
3. **What patterns the codebase uses** -- You know the conventions (naming, structure, error handling) and will follow them
4. **What dependencies are involved** -- You know which libraries, APIs, or modules interact with your change

If you can answer all four, start working. Do not chase the remaining 10% -- it has diminishing returns and burns context window for marginal benefit.

## Confidence Bands

| Confidence | Action |
|------------|--------|
| Below 70% | **Expand search scope.** You are missing fundamental understanding. Read more files, check imports, trace call chains. Use `tldr structure`, `tldr calls`, or `tldr arch` to get a broader view. |
| 70% - 90% | **Fill specific gaps only.** You understand the big picture but have 1-2 unknowns. Target those unknowns directly -- read the specific function, check the specific type, verify the specific config. Do not re-read files you already understand. |
| Above 90% | **Stop and start working.** You know enough. Remaining unknowns will resolve themselves during implementation. If you hit something unexpected, you can investigate then. |

## Common Traps

### Over-researching
Reading every file in a directory "just in case" when you already know which 3 files matter. This wastes context window and delays actual work.

### Under-researching
Jumping into implementation after reading one file. You will make wrong assumptions about patterns, miss existing utilities, or duplicate code that already exists.

### Perfectionist research
Trying to understand every edge case before writing any code. Edge cases are better discovered through tests than through reading.

## Practical Application

When starting a task:
1. Read the entry point file and its immediate dependencies
2. Check for existing patterns (search for similar implementations)
3. Identify the test file and understand test conventions
4. Assess your confidence against the four questions above
5. If 90% or above, start writing code
6. If below, identify exactly what you do not know and target that gap
