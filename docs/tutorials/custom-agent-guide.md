# Create a Custom Agent

This tutorial walks through creating a new vibecosystem agent from scratch. By
the end, you will have a Markdown agent file, a prompt that describes the
agent's job, and a routing matrix entry that helps the ecosystem choose it for
the right work.

## Before You Start

You need:

- A local clone of `vibecosystem`
- A text editor
- Node.js 18 or newer if you want to run the `vibeco` CLI

Agent definitions live in `agents/`. Each agent is a Markdown file with YAML
frontmatter followed by the system prompt for that role.

## 1. Choose the Agent Name

Start with a narrow job. A good agent name describes one responsibility instead
of a broad team role.

Good names:

- `api-error-handler`
- `payment-webhook-expert`
- `react-form-auditor`

Avoid names that are too broad:

- `developer`
- `helper`
- `fixer`

Use kebab-case for both the file name and the `name` field:

```text
agents/api-error-handler.md
```

## 2. Create the Agent File

Create a new Markdown file in `agents/`:

```bash
touch agents/api-error-handler.md
```

Every agent starts with YAML frontmatter. This metadata tells vibecosystem how
to identify the agent and which tools it can use.

```yaml
---
name: api-error-handler
description: >-
  Designs and reviews API error handling, status codes, and response payloads
model: opus
tools: [Read, Edit, Grep, Glob]
---
```

### Frontmatter Fields

| Field | Required | Purpose |
| ------- | -------- | ------- |
| `name` | Yes | Kebab-case identifier. Match the file name without `.md`. |
| `description` | Yes | One clear sentence explaining when to use this agent. |
| `model` | No | Use `opus` for deep reasoning or `sonnet` for speed. |
| `tools` | No | Limit the agent to the tools it needs for the job. |
| `memory` | No | Use `user` when the agent should keep persistent learning. |

Keep the description practical. The routing system and humans both rely on it
to understand when the agent should be selected.

## 3. Write the Agent Prompt

After the frontmatter, write the prompt that defines the role. A strong prompt
answers four questions:

- What is this agent responsible for?
- What should it inspect before acting?
- What should it produce?
- What should it avoid?

Here is a complete starter agent:

```markdown
---
name: api-error-handler
description: >-
  Designs and reviews API error handling, status codes, and response payloads
model: opus
tools: [Read, Edit, Grep, Glob]
---

# API Error Handler

You design and review API error handling for backend services.

## Responsibilities

- Check that status codes match the failure type.
- Make error response bodies consistent across endpoints.
- Confirm that validation errors are actionable for API consumers.
- Look for accidental leaks of secrets, stack traces, or internal identifiers.

## Workflow

1. Read the relevant endpoint, controller, schema, and tests.
2. Identify the current error response shape.
3. Compare the behavior against nearby endpoints.
4. Recommend or implement the smallest consistent change.
5. Add or update tests when behavior changes.

## Output

- Summary of the current behavior
- Proposed response shape
- Files changed or files that should change
- Test cases that cover the error path

## Guardrails

- Do not invent a new error format if the project already has one.
- Do not expose internal implementation details in public API responses.
- Do not change successful response payloads unless the task requires it.
```

## 4. Keep the Agent Focused

Before you move on, check the prompt against this quick checklist:

- The agent has one primary job.
- The prompt explains what files to inspect.
- The output format is concrete.
- The guardrails prevent common mistakes.
- The agent only has the tools it needs.

If the agent needs domain knowledge, reference an existing skill from
`skills/` in the prompt instead of copying a large amount of guidance into the
agent file.

## 5. Test the Agent Definition

Run a few local checks before opening a pull request.

First, confirm the frontmatter starts on the first line:

```bash
head -1 agents/api-error-handler.md
```

The output should be:

```text
---
```

Then confirm the agent appears in the CLI:

```bash
vibeco list agents --search api-error-handler
```

If you are testing before installing the CLI, inspect the file directly:

```bash
grep -n "name: api-error-handler" agents/api-error-handler.md
grep -n "description:" agents/api-error-handler.md
```

For a contribution to this repository, also check that the Markdown file is
plain text and does not include generated secrets, local paths, or private
project details.

## 6. Add the Agent to the Routing Matrix

The routing matrix lives in `rules/agent-assignment-matrix.md`. It maps a task
category to a primary agent, a backup agent, and a QA agent.

Find the table that best matches your agent. For the example above, add an API
error handling row near the backend and API entries:

```markdown
| API errors | api-error-handler | backend-dev | code-reviewer |
```

Choose the columns carefully:

- `Task Kategorisi`: The kind of user request that should trigger the agent.
- `Ana Agent`: Your new agent.
- `Yedek Agent`: A reasonable fallback if the specialist is unavailable.
- `QA Agent`: The reviewer or verifier that should check the result.

Only add a routing row when the agent should be selected automatically. If the
agent is experimental or very narrow, it may be better to leave it discoverable
by name until it is proven useful.

## 7. Open the Pull Request

Before opening a PR, review the diff:

```bash
git diff -- agents/api-error-handler.md rules/agent-assignment-matrix.md
```

Use a concise commit message:

```bash
git add agents/api-error-handler.md rules/agent-assignment-matrix.md
git commit -m "feat: add api error handler agent"
```

In the PR description, include:

- What the new agent does
- Why it belongs in vibecosystem
- Which routing matrix row was added
- How you tested the frontmatter and discovery

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| The agent is not discovered | Check the file path and frontmatter. |
| The routing row feels too broad | Narrow the task category. |
| The prompt is too long | Move reusable guidance into a skill. |
| The agent overlaps another agent | Narrow it or improve the existing agent. |

## Next Steps

After your first agent works, consider adding a related skill in `skills/` if
the agent repeatedly needs the same checklist, examples, or implementation
patterns.
