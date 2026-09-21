# Failure policy

`/plan-goal` never asks for input, but must halt instead of shipping broken or incoherent work.

Use the failure policy when:

- exploration cannot produce a safe and coherent functional interpretation after its one retry,
- exploration determines the goal is infeasible or outside the repository's feasible responsibility,
- the proposal produces no actionable tasks,
- the proposal materially contradicts the exploration brief,
- a task wave stalls because tasks remain but none are eligible,
- a task exhausts its single retry,
- tests, lint, build, type checks, or required verification fail and cannot be cleared by re-waving,
- any verification command (lint, typecheck, test) exits non-zero after the apply phase and re-waving does not clear it,
- archive verification still prints `ARCHIVE_FAILED` after one retry,
- required repository state is missing or inconsistent before output,
- or a merge conflict cannot be resolved cleanly and automatically.

On failure:

1. Stop the pipeline.
2. Do not merge.
3. Do not push the default branch.
4. Leave `$BRANCH` intact whenever it exists.
5. Abort any incomplete merge.
6. Restore the Phase 1 goal stash on `$START_BRANCH`.
7. If stash restoration conflicts, preserve the stash and report its reference.
8. Report: the failed phase, the exact failed postcondition, commands or verification that failed, retry attempts, current branch, repository state, completed commits, archive state, and the safest manual next step.

For loop-engineering, a clean failure with the feature branch preserved is the correct outcome. Never merge or ship unverified work.
