**ALL GitLab data MUST come from `glab` CLI. NEVER use webfetch, HTTP requests, or browser MCP tools for GitLab operations, even if glab CLI fails. If `glab` is unavailable, report as a blocker.**
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

The `pc-plan-apply` skill already committed each task group: usually only screenshots or small residuals remain. Stage **specific paths only** (never `git add -A`, it sweeps unrelated files into the ship commit):

```bash
git add openspec/changes/{change-name}/images/  # plus any other paths you actually changed
git commit -m "{change}: {summary}"   # only if there is something to commit
git push -u origin "$BRANCH"
```

### Step 4: Upload screenshots (if any)

If screenshots exist, upload them so they can be referenced in the MR description:

```bash
glab api --method POST "projects/:id/uploads" -f "file=@openspec/changes/{change-name}/images/{feature}.png"
```

(`:id` is glab's placeholder for the current project: this is the one sanctioned use of git context in this skill.)

Parse the returned `markdown` field: use it to embed the image in the MR description. If the upload fails (the endpoint needs multipart form data and `-f` support varies by glab version), fall back to referencing the image committed on the branch instead.

If no UI changes, skip this step.

### Step 5: Create Merge Request

```bash
glab mr create \
  --source-branch "$BRANCH" \
  --target-branch "$DEFAULT_BRANCH" \
  --title "{title}" \
  --description "Closes {issue-link}

## Summary
{summary from proposal.md}

## Changes
{key changes from tasks.md}

## Test plan
- [ ] {checklist of manual verification steps}
{screenshots if available}" \
  --remove-source-branch \
  --squash-before-merge
```

Do NOT use `--yes` unless running in autopilot/non-interactive mode.

### Step 6: Report

Display:

```text
Merge Request created
  MR: {mr-url}
  Title: {title}
  Source: {branch}
  Target: {default-branch}
```

---