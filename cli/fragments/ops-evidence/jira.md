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
<!-- pc-visual-evidence-status:{status} -->

Status: `{status}`

{reason?}

Manifest and assets: {commit-pinned links when available, otherwise committed paths and SHA}

{prMarkdown}

{image-line?}
```

### Step 3 — Upsert the comment on the issue

`acli` cannot edit a comment in place, so match on the status probe rather than the change id alone. Matching the change id alone leaves a stale `blocked` comment standing after a later run succeeds:

```bash
# Skip only when this exact status is already published for this change.
acli jira issue comment list --key {issue-key} 2>/dev/null | grep -q "pc-visual-evidence-status:{status}" \
  || acli jira issue comment --key {issue-key} --body "$BODY"
```

When an earlier comment carries this change id with a different status, this one supersedes it: open the body with `Supersedes the earlier evidence comment for this change.` so a reader can tell which is current.

- If the comment command fails: report it. Fail the run ONLY when publishing was declared a ship gate; otherwise continue.
