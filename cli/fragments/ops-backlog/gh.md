**ALL GitHub data MUST come from `gh` CLI. NEVER use webfetch, HTTP requests, or browser MCP tools for GitHub operations, even if gh CLI fails. If `gh` is unavailable, report as a blocker.**
Always pass `--repo {owner}/{repo}` explicitly, never rely on git context to resolve the repo.

---

### Step 1: Parse input

`$ARGUMENTS` is the issue title/description. If it contains a title and body separated by a newline or `---`, split them. Otherwise use the full text as the title with an empty body.

### Step 2: Create issue

```bash
gh issue create \
  --repo {owner}/{repo} \
  --title "{title}" \
  --body "{body}"
```

### Step 3: Report

```text
Issue created
  URL: {issue-url}
  Number: #{number}
  Title: {title}
```

Tell the user: "Use `/plan-propose {issue-url}` to turn this into a plan."

---