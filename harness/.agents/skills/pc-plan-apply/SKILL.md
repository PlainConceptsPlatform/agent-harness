---
name: pc-plan-apply
description: Implement tasks from a plan. OpenSpec-annotated tasks (from pc-plan-propose) run as parallel subagent waves; Todo pane tasks (from /plan-quick) run sequentially in-session. Load when implementing a prepared plan. Invoked by the /plan-apply command (interactive) and the plan-goal pipeline (autonomous).
license: MIT
---

# Plan Apply

## Input

The caller provides (all optional):
- A mode (see below). Default: `interactive`.
- A `start_from` hint: `branch` (default, full protocol from step 1) or `load-plan` (the caller already created the feature branch; skip step 1).

## Modes

- `interactive` (default): report progress to the user and surface failures for their decision.
- `autonomous`: do not return control between waves; keep looping until every task is DONE or the progress guard / retry limit trips. On a stall or exhausted retry, stop the wave loop and report to the caller (whose failure policy governs). When all tasks are DONE, the APPLY stage is complete. Hand control back to the caller (the `/plan-goal` pipeline) so it continues with the next phase. Do not end the turn here; "report N/N tasks" is a stage boundary, not a finish line.

## Plan source detection

1. Check if an OpenSpec change exists: inspect `openspec/changes/` for an active change folder with a `tasks.md`.
2. If found and tasks have `<!-- agent` annotations (written by `pc-plan-propose`): OpenSpec mode. Follow the protocol below. Annotated tasks run in subagent waves. They never become sequential lead work because the task count seems small, the lead prefers direct implementation, or a worker has not yet been inspected.
3. If no OpenSpec change exists, but there are `pending` items in the Todo pane (from `/plan-quick`): Simple mode. Follow the [simple mode](simple-mode.md) reference.

## OpenSpec mode: parallel subagent waves

Load `@openspec-apply-change` skill and follow its instructions, replacing Step 6 (Implement) with the protocol below.

**Step 6: Implement via native subagent waves. Replace the default step 6 with this protocol.**

You are the lead. You orchestrate from this session only; you spawn workers with the native `task` tool. Workers are ephemeral (one batch, then they exit) and navigable (`ctrl+x` arrow down, left/right arrows). There is no board, no claiming, no merging, no external dashboard.

Core rule: push, don't pull. A worker is born with its work: every `task()` spawn prompt contains the exact task IDs and text it must do. There is no claim step, so a worker can never sit idle waiting for an assignment.

**1. Branch.** Create `feature/{change-slug}` if not already on one. (Skip this step when the caller passed `start_from: load-plan`.)

**2. Load the plan and workers.** Parse `tasks.md`. Each task carries `<!-- agent, depends_on, touches -->` (from `pc-plan-propose`). Inspect `.opencode/agents/` for each base engineer and its generated `.<tier>.md` variants. The tier-suffixed name in an annotation (for example, `backend-engineer.build`) is the worker to spawn: `pc-subagent-tiers` resolves its model at startup and registers it as `mode: subagent`. Read `.opencode/harness.json` -> `agents.maxConcurrent` (the wave cap, 1 to 5).

Before hydrating the Todo board, resolve every task's annotated worker. If any task has a blank agent annotation, its base template is missing, or its tier variant is unavailable, stop the APPLY stage and report the task ID, expected worker, and missing file. Do not replace the worker with `fullstack-engineer`, `general`, or the lead session.

**3. Hydrate the Todo board.** `todowrite` one item per task: `pending`. The Todo pane is the visible subagent board (opencode plugins cannot draw a custom pane, so the native Todo widget is the live UI). While a task is in flight, its label must carry the worker: `<agent> · <model>`: so the pane shows which agent on which model is doing what. The Todo list is a projection only: never read it for recovery; rebuild it from `tasks.md` and git and `.opencode/harness-run.json`.

**4. Worker context.** Before each wave, derive file-disjointness from `touches:` globs and `git diff`.

<!-- PC-OPTIMIZATION-CODEGRAPH-START -->
<!-- PC-OPTIMIZATION-CODEGRAPH-END -->

<!-- PC-OPTIMIZATION-MEMORY-START -->
<!-- PC-OPTIMIZATION-MEMORY-END -->

**5. The wave loop.** Repeat until no tasks remain:

```
eligible = unchecked tasks whose every depends_on is DONE (committed/checked)
if eligible is empty but tasks remain  -> STALL: report blocked tasks + the failed
                                           dependency causing it, then STOP.
groups   = pack eligible tasks that share a file (touches and gathered context)
            into ONE worker each, to run sequentially (the worker uses the task's `agent`)
wave     = pick groups whose file-sets are pairwise DISJOINT, capped at maxConcurrentAgents
            (you enforce the cap: opencode runs every task() you emit at once)
```

**6. Context per group.** For each group, gather the task text, relevant plan decisions, and source context needed to implement it.

**7. Spawn the wave: one assistant turn, multiple `task()` calls (they run in parallel).** For each group:
- `subagent_type` = the task's `agent` exactly as written in `tasks.md` (e.g. `frontend-engineer.build`, `backend-engineer.fast`). It is the tier-suffixed `mode: subagent` worker created by `pc-subagent-tiers`. Worker resolution happened in step 2; a missing worker stops the stage before spawning. `fullstack-engineer`, `general`, and the lead session are not fallbacks for annotated implementation work.
- `description` = `"<task-ids>: <short label>"` (e.g. `"2.1,2.2: RPC endpoints"`) so the subagent is legible in the left/right list and the monitor.
- `prompt` must contain the exact task IDs and text plus the gathered context. The worker follows the Engineer workflow defined in `@pc-guardrails-generic`; do not restate it in the prompt. **Worker output discipline:** instruct each worker to return a compact summary: what it changed (file names, not contents), pass/fail status of any verification it ran, and any blockers. Workers must NOT return file contents or full diffs as their result — the lead can `git diff` if needed.
- Flip each spawned task's Todo item to `in_progress` and prefix its label with `<agent>: ` (e.g. `frontend-engineer.build: 2.1 Consolidate logic`) so the running worker is visible in the Todo pane. On completion, drop the prefix and mark `completed`.

**8. Collect the wave.** Each foreground `task()` returns its result to you. For each group:
- success: `git add` the group's `touches` paths and commit `"{ids}: {summary}"` in a single tool call (`git add <paths> && git commit -m "..."`); mark its Todo items `completed`; check `[x]` in `tasks.md`.
- error / empty: revert that group's impact: `git checkout -- <tracked paths> && git clean -f -- <paths>` (one tool call). Mark `failed` and record the reason in `tasks.md`; `.opencode/harness-run.json` is owned by the monitor plugin. Then retry once with a shorter prompt. Still failing: leave failed and surface it; do not loop.
- A failed group only blocks its dependents; unrelated tasks keep flowing.

**9. Progress guard.** If a full wave moved zero tasks to DONE: STOP (do not re-spawn the identical failing set). Otherwise recompute `eligible` and loop to step 5.

**10. Verify.** In this (lead) session, run the project's lint, typecheck, test, build, and proposal-required validation commands. Every command must exit 0. On failure, reopen the offending tasks (uncheck, mark failed) so they re-enter `eligible` and run another wave. When every task is checked, no eligible task remains, and every command passes, report `VERIFIED` to the caller.

**11. Close.** Mark all `tasks.md` checkboxes, run `openspec status --change "<name>" --json`, and report progress (N/M tasks). The wave state in `.opencode/harness-run.json` persists for resume.

Resume: re-loading this skill after any crash recomputes DONE / FAILED / eligible from `tasks.md`, git, and `harness-run.json` and continues. State is on disk, not in this conversation.
