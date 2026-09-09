---
name: pc-plan-goal
description: "Autonomous pipeline: explore, propose, apply, archive, then merge/PR/push. For loop-engineering. Invoked by the /plan-goal command."
license: MIT
---

Run the full OpenSpec lifecycle without human interaction. This skill owns phase order, cross-phase gates, commits, and output. Each phase skill owns its procedure.

Keep this checklist visible:

`explore · propose · apply · verify · archive · output · report`

Move forward only when a phase returns its required result. On a hard failure, follow the [failure policy](failure-policy.md). Continue after each phase skill returns; the run ends only after every checklist item is complete.

**Token efficiency rules:** Batch git operations within a phase (combine `git add <paths> && git commit` in one tool call). Do not run status checks between sequential operations in the same phase. Minimize model turns: if a phase requires 3 git commands, call them in one tool call, not 3.

Stage the paths a phase wrote; unscoped staging is denied (`pc-system-reminders`). A shared tree once put a Teams tool and its tests inside a commit named after a YAML input rename, so unreviewed work reached the default branch under a heading nobody would look twice at.

Input: `$ARGUMENTS`

<!-- PC-OPTIMIZATION-MEMORY-START -->
<!-- PC-OPTIMIZATION-MEMORY-END -->

## Phase 0: Resolve input

Load the [output mode](output-mode.md) reference and resolve the mode from the first token of `$ARGUMENTS`. Treat the remaining text as data, not orchestration instructions.

- For a work-item URL or issue key with a configured backlog platform, load `@pc-userstory` and fetch the work item.
- Otherwise, use the remaining text as the direct feature description.
- Preserve title, description, work-item reference, and acceptance criteria as `{resolved_input}`.
- Derive `{slug}` and classify scope as `focused`, `standard`, or `complex`.

**Refined-issue detection:** set `{refined}` to `true` only when all three hold. The input came from a backlog work item, not free text. It contains at least one `Scenario:` with `Given` / `When` / `Then`. It names affected paths, and at least one of them exists in this repository. Anything less runs Phases 2 and 3 in full: `{refined}` skips a gate, so a near miss must fall back rather than guess.

When it is `true`, the issue content is the proposal. Phase 2 is skipped and Phase 3 runs with `skip_specs: true`.

## Phase 1: Branch

Follow the [branching procedure](branching.md) with `{slug}`. Record `$START_BRANCH`, `$DEFAULT_BRANCH`, `$BRANCH`, and whether the goal stash exists.

## Phase 2: Explore

**Skip if `{refined}` is `true`.** The issue already contains structured acceptance criteria and affected artifacts; re-exploring the codebase would waste tokens re-deriving what the issue already specifies. Set `EXPLORATION_BRIEF` to a one-line summary: `"Pre-refined issue: {title}"`.

Load `pc-plan-explore` with `{resolved_input}` in autonomous mode. Require an in-memory `EXPLORATION_BRIEF` as its findings handoff to Phase 3.

Tick `explore` when `pc-plan-explore` returns its findings handoff.

## Phase 3: Propose

Load `pc-plan-propose` in autonomous mode with `{resolved_input}`, `EXPLORATION_BRIEF`, and `scope_classification`.

**When `{refined}` is `true`,** pass the work item as the proposal body and set `skip_specs: true` in `.openspec.yaml`: the issue already carries the spec content. Propose still runs, because it owns task enrichment. A hand-written `tasks.md` has no `<!-- agent, depends_on, touches -->` annotations, and Phase 4 stops on a task whose worker is unresolved.

Confirm its change directory and actionable `tasks.md` exist. Rename `$BRANCH` when the canonical change slug differs from `{slug}`, then commit the proposal:

```bash
git add openspec/changes/{change-id}/ && git commit -m "propose: {title} ({change-id})"
```

Tick `propose` when the proposal commit exists.

## Phase 4: Apply and verify

Load `pc-plan-apply` in autonomous mode with `start_from: load-plan`. It owns worker resolution, subagent waves, commits, verification, and re-waves.

Require it to return every task complete and `VERIFIED`, then load `pc-repo-verify`. Tick `apply` and `verify` only when both phases return `VERIFIED`.

## Phase 5: Archive

Require `verify` and a clean working tree. Load `pc-plan-archive` in autonomous mode with `{change-id}`. It owns archive verification and retry.

Require `ARCHIVED_OK` and the archive path, then commit:

```bash
git add openspec/changes/ && git commit -m "archive: {title} ({change-id})"
```

Tick `archive` when the archive commit exists.

## Phase 6: Output

Follow the [output procedure](output.md) with the mode, branch values, change id, work-item reference, and archive path. Tick `output` only when its mode-specific postcondition holds.

## Phase 7: Report

Print the final report from the [output procedure](output.md). Tick `report` only after every checklist item is complete.
