# vibecosystem

**AI Software Team** -- 139 agents, 274 skills, 60 hooks, 23 rules

This file is for **Codex CLI** (OpenAI). If you're using Claude Code, see `CLAUDE.md` or just run `./install.sh`.

## What is this?

vibecosystem turns your AI coding assistant into a full software team. Specialized agents plan, build, review, test, and learn from every mistake. No configuration needed.

## Setup (Codex CLI)

```bash
./install-codex.sh
```

This copies all skills to `~/.codex/skills/` where Codex CLI auto-discovers them.

## Available Skills

All 274 skills in `skills/` follow the standard SKILL.md format. Key categories:

| Category | Examples |
|----------|---------|
| Development | coding-standards, backend-patterns, frontend-patterns, fullstack-dev |
| Testing | tdd-workflow, test-strategy, e2e, python-testing, golang-testing |
| Security | security-review, secret-patterns, supply-chain-security, concurrency-security |
| Architecture | api-patterns, graphql-patterns, event-driven-patterns, cqrs-expert |
| DevOps | docker-ops, kubernetes-patterns, terraform-patterns, ci-cd-pipeline |
| Database | postgres-patterns, mongodb-patterns, redis-patterns, elasticsearch-patterns |
| Cloud | aws-patterns, gcp-patterns, azure-patterns |
| Performance | load-testing-patterns, caching-patterns, observability, tracing-patterns |
| Compliance | kvkk-compliance, compliance-patterns |
| AI/ML | prompt-engineering, rag-patterns, vector-db-patterns, llm-tuning-patterns |

## Key Rules

### Immutability
Never mutate objects. Create new ones:
```javascript
// Wrong
user.name = name
// Right
return { ...user, name }
```

### Error Handling
Every function that can fail must have try/catch. Every data can be null -- check it. Every API can timeout -- add retry.

### Input Validation
Validate at system boundaries. Use schema validation (Zod, JSON Schema, etc.).

### Code Organization
- 200-400 lines per file (800 max)
- Functions under 50 lines
- No more than 4 levels of nesting
- Feature/domain-based organization

### Testing
- TDD: write test first (RED), implement (GREEN), refactor (IMPROVE)
- Target 80%+ coverage
- Unit tests for functions, integration for APIs, E2E for critical flows

### Security Checklist
- No hardcoded secrets (use environment variables)
- Validate user input
- Use parameterized queries (no SQL injection)
- Prevent XSS
- Error messages must not leak sensitive data

### API Response Format
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { total: number; page: number; limit: number }
}
```

### Git Conventions
- Commit format: `<type>: <description>`
- Types: feat, fix, refactor, docs, test, chore, perf, ci
- Keep commits atomic and focused

## Agent-like Skills

Since Codex CLI uses a single-agent model, vibecosystem agents are available as skills. Use them by referencing:

- `coding-standards` -- universal code quality
- `security-review` -- security audit checklist
- `tdd-workflow` -- test-driven development
- `backend-patterns` -- API design, database, server-side
- `frontend-patterns` -- React, Next.js, state management
- `docker-ops` -- container best practices
- `postgres-patterns` -- database optimization
- `api-patterns` -- REST/GraphQL design

## Philosophy

```
Hooks are sensors -- observe, filter, signal.
Agents are muscles -- build, produce, fix.
The bridge between them: context injection.
Implicit coordination through context.
```

## Links

- GitHub: https://github.com/vibeeval/vibecosystem
- Full docs: See `docs/` directory
- Claude Code setup: `./install.sh`
- Codex CLI setup: `./install-codex.sh`
