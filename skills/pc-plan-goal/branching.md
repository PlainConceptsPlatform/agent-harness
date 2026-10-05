# Branching procedure

Resolve and record the branch names. If the invoking workflow already placed you on a feature branch (`feature/*`, `fix/*`, etc.), it owns the branch: do not stash, switch, pull, or rename. The sandbox hosting the workflow has no git credentials, so those commands would either corrupt the tree or hang, and the workflow has already cut the branch from the default branch. Treat its result as given.

```bash
BRANCH="$(git branch --show-current)"
case "$BRANCH" in
  feature/*|fix/*|chore/*|docs/*|refactor/*)
    START_BRANCH="$BRANCH"
    DEFAULT_BRANCH="$BRANCH"
    GOAL_STASH="none"
    ;;
  *)
    START_BRANCH="$BRANCH"
    DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
    [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"

    # Stash uncommitted work when needed and record that the goal stash exists.
    git stash push -u -m "goal-wip"
    GOAL_STASH="goal-wip"

    # Create the feature branch from the synchronized default branch.
    git switch "$DEFAULT_BRANCH"

    if git remote get-url origin >/dev/null 2>&1; then
      git pull origin "$DEFAULT_BRANCH"
    fi

    git switch -c "feature/{slug}"
    BRANCH="$(git branch --show-current)"
    ;;
esac
```

Record the branch name and that `feature/{slug}` was applied unconditionally, so downstream phases can restore if they move off it.

Everything through archive happens on `$BRANCH`.

When a later phase renames `$BRANCH` to match the canonical change slug (Phase 3 of `pc-plan-goal`), skip the rename if the workflow already fixed the name. Renaming would call `git branch -m`, which a credentialless sandbox refuses, and the workflow's `create_pull_request` is told to use the branch as named. Detect this by checking that `$BRANCH` already starts with `feature/`; if it does, keep it.
