**ALL GitHub data MUST come from `gh` CLI. NEVER use webfetch, HTTP requests, or browser MCP tools for GitHub operations, even if gh CLI fails. If `gh` is unavailable, report as a blocker.**
Always pass `--repo {owner}/{repo}` explicitly, never rely on git context to resolve the repo.

---

### Step 1: Find PRs

If PR link provided, extract number from URL. Otherwise:

```bash
gh pr list --repo {owner}/{repo} --state open --limit 1
```

### Step 2: Read comment threads

```bash
gh pr view {pr-number} --repo {owner}/{repo} --comments
# Or structured output:
gh api repos/{owner}/{repo}/pulls/{pr-number}/comments
gh api repos/{owner}/{repo}/pulls/{pr-number}/reviews
```

### Step 3: Categorize feedback

| Category      | Description                         | Action                              |
| ------------- | ----------------------------------- | ----------------------------------- |
| `code-change` | Reviewer requests code modification | Return to lead to spawn specialists |
| `spec-update` | Affects proposal, design, or tasks  | Update openspec artifacts           |
| `question`    | Reviewer asks a question            | Reply with answer                   |
| `resolved`    | Thread already resolved             | Skip                                |

### Step 4: Update openspec (if spec-update)

```bash
git branch --show-current
# feature/add-user-auth → change: add-user-auth
```

Update: `openspec/changes/{change}/proposal.md`, `design.md`, or `tasks.md` as appropriate.

### Step 5: Reply to each comment thread

```bash
# Reply to a review comment
gh api repos/{owner}/{repo}/pulls/{pr-number}/comments/{comment-id}/replies \
  --method POST \
  --field body="Acknowledged, applying this change now."

# Or post a general PR comment
gh pr comment {pr-number} --body "Updated design.md to reflect feedback."
```

---