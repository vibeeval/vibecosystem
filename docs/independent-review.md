# Independent agent review record

The reviewers did not own the source edits. These are separate automated review contexts, not an external human certification. Reproduction data were synthetic and confined to temporary directories.

## Earlier diff review

`/root/independent_review` and `/root/independent_review/security_readonly` found regressions in repeated legacy ownership migrations, dashboard HTML/prototype handling, dashboard hook registration, remote argument handling, Codex manifest validation and exhausted-budget routing. Those findings were repaired and rechecked.

## Exact candidate review

Fresh reviewers without inherited implementation history examined `1844d11382d534093888dd214c0a67f6dc858691` against `3b763b1fb288f57bfa3cce76ef18184b96461a78` on 2026-11-04 UTC:

| Reviewer | Scope | Findings at that commit |
| --- | --- | --- |
| `/root/final_security_review` | Filesystem, migrations, memory side effects, credentials, dashboard | Memory symlink escape and executable-mode loss |
| `/root/final_behavior_review` | Context/permission semantics, core skills, packed runtime | Independently reproduced executable-mode loss; no additional actionable finding in its hook/context slice |
| `/root/final_security_review/dashboard_review` | HTTP/WS callbacks, schema and UI | No confirmed P1/P2 in the inspected dashboard paths |
| `/root/final_behavior_review/package_skill_boundary` | Installer/package/skill boundaries | Confirmed mode loss omitted by the original tests |

## Repairs and rechecks

Installer repair `54cd0bfb9a9e527dfa70033ce8eb49dd80620c12` preserves source permissions and tracks owned modes. Both primary reviewers independently confirmed real helpers retain 0755, an unchanged legacy 0644 installation can be repaired, and custom permissions survive repeated installation and profile reconciliation. The packed-runtime regression checks the executable core helper.

The memory repair rejects links in metadata/memory descendants, opens regular files without following final symlinks and verifies the opened inode. Tests cover all three scopes, file/ancestor links, legitimate root aliases, unrelated-file preservation and prevention of synthetic secret injection. Cooperative locking protects append, retention and index updates. Eight regression-test processes and sixteen independently launched savers crossing the retention threshold retained every distinct new learning. Busy or abandoned locks diagnose and skip after a bounded wait; recovery requires reviewing the lock after writers stop.

The security reviewer independently reran the original destructive-write and secret-read fixtures against repair bundles, plus directory/metadata links and legitimate operations. The behavior reviewer also exercised a 37,066-character Task prompt with a 64-character advisory budget: all original tool fields remain intact, only new context is charged, and zero budget permits the original tool operation.

See [verification.md](verification.md) for final totals and reproduction commands. Reviewer-authored reports, standalone harnesses and source hashes are retained in the local delivery artifacts. Reviewers did not modify repository source.

## Linux CI follow-up

GitHub run [41922050896](https://github.com/vibeeval/vibecosystem/actions/runs/41922050896) passed the hook suite but exposed a packed PreCompact failure: a bundled library's direct-CLI check fired on canonical Linux paths. macOS temporary-path aliases had hidden it locally. `/root/final_behavior_review` independently reproduced that exact red/green difference. The parser implementation now lives in a pure shared module; the compatibility CLI remains separate. The packed-runtime fixture resolves canonical paths on both platforms.

The CI-adjacent security pass also reproduced PreCompact ledger/handoff symlinks writing outside a synthetic project. `/root/final_security_review` and its static subreview checked the repaired output guards against seven negative link cases and two legitimate workflows. `/root/final_behavior_review` separately verified manual compaction, transcript-driven and fallback summaries, direct CLI aliases/encoded paths, preserved parser exports and truthful no-save messages. Sixteen new regressions cover these paths; neither reviewer reported an actionable P1/P2 in the frozen follow-up source.

## Limits

No live host/provider, real billing, production database, working native SQLite or live TLDR service was validated. Path checks do not promise an operating-system sandbox against hostile same-user directory swaps or hardlinks. An abandoned lock can suppress optional learning until reviewed. These checks reduce uncertainty within the inspected paths; they do not prove the entire catalog has no defects.
