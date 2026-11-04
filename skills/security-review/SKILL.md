---
name: security-review
description: Review concrete trust boundaries when changing authentication, input handling, secrets, APIs, payments, or sensitive data flows.
---

# Security Review

Scope the review to the changed behavior and its callers. Identify assets, attacker-controlled inputs, trust boundaries, authorization checks, data sinks and external effects. Trace a concrete path rather than declaring an exploit from a keyword.

Check relevant boundaries:

- Authentication and per-object authorization before protected reads or writes; server-side validation and bounded resource use.
- Parameterized queries, safe command arguments, path containment and symlink handling where inputs reach databases, shells or filesystems.
- Output escaping appropriate to HTML, attributes, URLs or script context; avoid inserting untrusted ledger or tool data through raw HTML.
- Browser Origin/Host checks, CSRF and cookie policy where local or remote endpoints accept browser requests.
- Secret storage, error/log redaction and explicit scope before sending code or data to another service.
- Dependency declarations, distributed build behavior and failures when optional components are absent.

Choose checks based on actual exposure. A regex guard is not a sandbox; a configured credential is not authorization for publication. Do not access real secrets, run live exploits, rotate keys, change permissions or start external scans without the relevant authorization.

Use synthetic fixtures and safe reproductions that distinguish intended from unsafe behavior. Preserve security decisions when advisory context is truncated. Review current primary documentation for uncertain framework-specific APIs.

Report concrete trigger, impact, evidence, severity, verification status and smallest repair. Separate a demonstrated defect from an unverified risk; avoid blanket compliance claims or universal checklists unrelated to the change.
