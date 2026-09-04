**NEVER use browser tools to navigate to atlassian.net: use `acli` CLI only. If `acli` is unavailable, skip publishing (report it) — do not fail the pipeline unless the caller declared publishing a ship gate.**

Publish one status comment for every manifest. A `blocked` or `failed` manifest must include its status and reason, never a success claim.

### Step 1 — Image hosting caveat

Jira comments cannot embed an image from a repo blob URL, and `acli` does not upload attachments inline. Use text evidence and derive a commit-pinned repository URL from `git remote get-url origin` when possible. Otherwise include the committed asset path, branch, and SHA:

```
Screenshot committed at: {asset-path} (branch {branch}, commit {sha})
```

### Step 2 — Build the comment with a stable marker (idempotent)

```
<!-- pc-visual-evidence:{change-id} -->

Status: `{status}`

{reason?}

Manifest and assets: {commit-pinned links when available, otherwise committed paths and SHA}

{prMarkdown}

{image-line?}
```

### Step 3 — Upsert the comment on the issue

Keep it idempotent: list existing comments and skip if one already carries the marker for this change id, otherwise add:

```bash
acli jira issue comment list --key {issue-key} 2>/dev/null | grep -q "pc-visual-evidence:{change-id}" \
  || acli jira issue comment --key {issue-key} --body "$BODY"
```

- If the comment command fails: report it. Fail the run ONLY when publishing was declared a ship gate; otherwise continue.
