---
name: differential-review
description: Security-focused differential code review with blast radius analysis, risk-adaptive depth (DEEP/FOCUSED/SURGICAL), git history correlation, and structured finding format. Adapted from Trail of Bits. Use when reviewing PRs, commits, or code changes for security implications.
---

# Differential Review

Security-focused code review that adapts depth to codebase size and change risk. Goes beyond style -- finds vulnerabilities, logic errors, and blast radius.

## Review Depth Modes

### DEEP (Small codebase, < 5K lines changed)
- Line-by-line analysis of every changed file
- Full control flow tracing through changed paths
- Cross-reference every function call to its definition
- Check all error paths and edge cases

### FOCUSED (Medium codebase, 5K-50K lines)
- Prioritize files touching auth, crypto, input parsing, state mutation
- Trace data flow from inputs to outputs through changed code
- Skip cosmetic changes (formatting, comments, renames)
- Deep-dive only on security-sensitive paths

### SURGICAL (Large codebase, > 50K lines)
- Review only the diff, not surrounding code
- Focus exclusively on: new attack surface, removed security controls, changed trust boundaries
- Flag anything that needs a separate deep review

## Review Process

### Phase 1: Blast Radius Assessment
Before reading any code:

```bash
# What changed?
git diff --stat <base>...<head>

# How much changed?
git diff --shortstat <base>...<head>

# Which files are security-sensitive?
git diff --name-only <base>...<head> | grep -iE '(auth|crypto|token|secret|permission|middleware|validator|sanitiz)'
```

Classify the change:
- **Surface area**: How many files, functions, modules touched?
- **Trust boundary crossing**: Does data flow between trust levels?
- **Security control modification**: Are auth/authz/validation/crypto paths changed?
- **Data model change**: Are schemas, types, or storage formats modified?

### Phase 2: Git History Correlation
Check if the changed code has a history of bugs:

```bash
# How often has this file been changed? (churn = risk)
git log --oneline --follow <file> | wc -l

# Were there recent security fixes in this area?
git log --oneline --grep="fix\|vuln\|security\|CVE" -- <file>

# Who else has touched this code?
git log --format='%an' -- <file> | sort | uniq -c | sort -rn
```

High churn + security fix history = increase review depth.

### Phase 3: Structured Review

For each changed file, analyze in this order:

1. **Input validation**: Are new inputs validated? Are existing validations preserved?
2. **Authentication/Authorization**: Do access controls apply to new code paths?
3. **Data flow**: Can untrusted data reach sensitive operations?
4. **Error handling**: Do error paths leak information or skip cleanup?
5. **State mutation**: Are state changes atomic? Race conditions possible?
6. **Crypto usage**: Correct algorithms, key sizes, modes, IVs?
7. **Logging**: Are sensitive values logged? Are security events NOT logged?

## Finding Format

```
## [SEVERITY] Finding Title

**Location**: file.ts:42-58
**Category**: [Input Validation | Auth | Crypto | Data Flow | State | Logic]
**Confidence**: [HIGH | MEDIUM | LOW]

**Description**:
What the vulnerability is, in one paragraph.

**Impact**:
What an attacker can achieve by exploiting this.

**Proof**:
The specific code path or data flow that demonstrates the issue.

**Recommendation**:
Concrete fix with code example if possible.
```

## Severity Classification

| Severity | Criteria | Examples |
|----------|----------|---------|
| CRITICAL | Remote exploitation, no auth required, data breach | SQL injection, auth bypass, RCE |
| HIGH | Requires some access, significant impact | Privilege escalation, IDOR, stored XSS |
| MEDIUM | Limited impact or complex exploitation | Reflected XSS, info disclosure, CSRF |
| LOW | Minimal impact, defense-in-depth | Missing headers, verbose errors, weak config |
| INFO | Best practice, no direct vulnerability | Code quality, missing rate limit, logging gap |

## Rationalizations to Reject

Common excuses that lead to missed findings. Do NOT accept these:

| Rationalization | Why It's Wrong | Required Action |
|----------------|---------------|-----------------|
| "It's behind auth" | Auth can be bypassed | Verify auth is enforced AND correct |
| "We trust this input" | Trust boundaries change | Validate at every boundary |
| "It's just internal" | Internal networks get compromised | Apply defense in depth |
| "Nobody would do that" | Attackers do unexpected things | Test the unexpected case |
| "We'll fix it later" | Later never comes in security | Flag it NOW with severity |
| "The framework handles it" | Frameworks have bypasses | Verify the framework actually applies |
| "It's the same as before" | Before might have been wrong too | Review the original if suspicious |

## Anti-Hallucination Rules

- **Never say "It probably..."** -- say "Unclear; need to inspect X"
- **Never assume a function is safe** without reading its implementation
- **Never skip a finding** because it seems minor -- document everything
- **Every claim must reference a specific file and line number**
- **If you haven't read the code, say so** -- don't infer behavior from names

## Diff Review Checklist

```
[ ] Blast radius assessed (files, trust boundaries, security controls)
[ ] Git history checked for churn and past security fixes
[ ] All new inputs validated
[ ] Auth/authz applied to new endpoints/paths
[ ] Error handling doesn't leak sensitive info
[ ] No hardcoded secrets or credentials
[ ] State mutations are atomic
[ ] Crypto usage follows current best practices
[ ] Logging doesn't include sensitive data
[ ] Removed code didn't contain security controls that are now missing
[ ] Dependencies added/updated are from trusted sources
[ ] Test coverage exists for security-critical paths
```

## Integration with vibecosystem

- **code-reviewer agent**: Use this skill for security-focused review depth
- **security-reviewer agent**: Primary consumer of this skill
- **coroner agent**: Use blast radius analysis for post-mortem propagation
- **/review skill**: Automatically applies differential review to PRs

Inspired by [Trail of Bits](https://github.com/trailofbits/skills) differential-review plugin.
