**ALL GitHub data MUST come from `gh` CLI. NEVER use webfetch, HTTP requests, or browser MCP tools for GitHub operations, even if gh CLI fails. If `gh` is unavailable, report as a blocker.**
Always pass `--repo {owner}/{repo}` explicitly, never rely on git context to resolve the repo.

---

### Step 1: Verify feature branch

```bash
BRANCH="$(git branch --show-current)"
DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
[ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"
```

`$BRANCH` must be a work branch (`feature/*` or `bugfix/*`: the `pc-plan-apply` skill creates `feature/{change-slug}`). NEVER push the default branch.

### Step 2: Capture screenshots (if UI changes exist)

```bash
browser_navigate url="http://localhost:{port}/{route}"
browser_wait ms=2000
browser_screenshot
```

Save to: `openspec/changes/{change-name}/images/{feature}.png`

### Step 3: Commit and push

The `pc-plan-apply` skill already committed each task group: usually only screenshots or small residuals remain. Stage **specific paths only** (never `git add .`, it sweeps unrelated files into the ship commit):

```bash
git add openspec/changes/{change-name}/images/  # plus any other paths you actually changed
git commit -m "feat({scope}): {description} (#{id})"   # only if there is something to commit
git push -u origin "$BRANCH"
```

### Step 4: Create PR

```bash
gh pr create \
  --repo {owner}/{repo} \
  --base "$DEFAULT_BRANCH" \
  --head "$BRANCH" \
  --title "feat({scope}): {title} (#{id})" \
  --body "{description}"
```

### Step 5: Post screenshot comment

Resolve commit SHA (the commit that includes screenshots):

```bash
git rev-parse HEAD
```

Build blob URL for each image with `?raw=true` (a plain blob URL renders the GitHub HTML page, not the image, inside `![...]()`):

```
https://github.com/{owner}/{repo}/blob/{sha}/openspec/changes/{change}/images/{file}.png?raw=true
```

Note: on private repos the embedded image is only visible to users with repo access.

Post comment:

```bash
gh pr comment {pr-number} --repo {owner}/{repo} --body $'## Screenshots\n\n![{feature}]({blob-url})'
```

---