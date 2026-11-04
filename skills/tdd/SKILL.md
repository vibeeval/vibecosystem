---
name: tdd
description: Implement requested behavior with a meaningful red-green-refactor cycle using the project's test runner.
keywords: [tdd, test-driven, test-first, red-green-refactor]
---

# TDD

Apply when test-first work is requested or a regression meaningfully protects a repair. Avoid tests that mirror private implementation or trivial reversible edits.

1. Derive an observable acceptance case and inspect nearby tests and the real public entry point.
2. Write a meaningful test. Run it on old behavior and verify it fails for the intended reason rather than broken setup.
3. Implement the smallest complete change. Run the focused test and required checks.
4. Refactor with behavior covered. Verify affected integration boundaries; broaden the suite for shared contracts and unresolved risk.

Cover important failures and boundaries, including state isolation or concurrency when relevant. Use local fixtures and provider mocks at external boundaries. Separately exercise real integration contracts the change depends on.

Work directly unless independent test design or review helps. Claude can use installed `tdd-guide`, `spark` or `verifier`; Codex keeps parent settings. Tests and code need not use separate agents.

Report observed red/green results, commands and limitations. Coverage alone does not establish correctness. Honor scope and do not commit or publish without authorization.
