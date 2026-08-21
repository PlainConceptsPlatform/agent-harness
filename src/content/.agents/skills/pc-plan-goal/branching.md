# Branching procedure

Resolve and record the branch names:

```bash
START_BRANCH="$(git branch --show-current)"
DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"
```

Stash uncommitted work when needed and record that the goal stash exists:

```bash
git stash push -u -m "goal-wip"
```

Create the feature branch from the synchronized default branch:

```bash
git switch "$DEFAULT_BRANCH"

if git remote get-url origin >/dev/null 2>&1; then
  git pull origin "$DEFAULT_BRANCH"
fi

git switch -c "feature/{slug}"
BRANCH="$(git branch --show-current)"
```

Everything through archive and evidence happens on `$BRANCH`.
