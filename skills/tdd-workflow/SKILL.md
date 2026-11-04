---
name: tdd-workflow
description: Design focused tests and apply red-green-refactor techniques when test-driven development is requested.
---

# TDD Techniques

Use installed `tdd` for the overall workflow. This entry covers test design.

Test observable inputs, outputs, side effects, errors and important boundaries. Use unit checks for local decisions, integration checks for contracts, and end-to-end checks for important flows. Follow repository requirements rather than imposing a universal coverage threshold.

A regression fails against the old bug and passes with the repair. Use deterministic fixtures, isolated state and assertions that distinguish wrong from intended behavior. Avoid incidental snapshots, duplicated implementation and trivial wiring already exercised by a real entry-point check.

Mock paid or remote providers at the boundary. Validate request/response schemas and errors; mocked success alone does not prove the live integration. Use a separately authorized integration check where necessary.

Run focused checks first, then affected suites. Preserve diagnostics and fix flaky shared state rather than adding retries. Report what ran and what remains unverified.
