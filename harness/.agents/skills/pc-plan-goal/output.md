# Output procedure

Before output, require `verify`, `archive`, a clean working tree, no active change directory, and an archive directory for `{change-id}`.

## Restore stash

If the goal created `goal-wip`, restore it after the mode-specific operation. When restoration conflicts, leave the stash intact, report its `git stash list` reference, and do not drop user work.

## Default mode

Synchronize the default branch, merge, delete the feature branch, then restore the stash:

```bash
git switch "$DEFAULT_BRANCH"

if git remote get-url origin >/dev/null 2>&1; then
  git pull origin "$DEFAULT_BRANCH"
fi

git merge --no-ff "$BRANCH" -m "goal: {title} ({change-id})"
git branch -d "$BRANCH"
```

If the merge conflicts, abort it and use the failure policy. Do not push the default branch. Evidence remains in the archive and publication is skipped because no commit-pinned repository URL exists.

## Push mode

Push the feature branch:

```bash
git push -u origin "$BRANCH"
```

When a work item exists, load `pc-ops-evidence` with `operation: publish`, `{change-id}`, the work-item reference, and `mode: push`. Publication is non-fatal. Restore the stash and leave the branch available.

## PR mode

Push the feature branch, then load `pc-ops-ship` to create a PR into `$DEFAULT_BRANCH`. Supply title, change id, functional summary, delivered acceptance criteria, task count, verification result, archive path, evidence result, and commits. Do not merge the PR.

When a work item exists, load `pc-ops-evidence` with `operation: publish`, `{change-id}`, the work-item reference, PR number, and `mode: pr`. Publication is non-fatal. Restore the stash.

## Final report

Print:

```text
Goal: {title}
Change ID: {change-id}
Scope classification: focused | standard | complex
Functional outcome: {one-sentence result}
Branch: {branch}
Tasks: {completed}/{total}
Acceptance criteria: {passed}/{total}
Commits: {proposal, apply, archive, evidence when present}
Verification: passed | failed
Archived: yes | no
Archive path: {path or none}
Evidence: passed | skipped | failed | blocked
Evidence assets: {paths or none}
Evidence publication: {published | skipped | failed}
Output mode: default | push | pr
Final state: merged locally | pushed branch | PR URL | branch preserved after failure
Stash restoration: not needed | restored | preserved after conflict
```

## External gate

An unattended caller must verify `openspec list --json` is empty and run the project's lint and typecheck commands before any later git operation.
