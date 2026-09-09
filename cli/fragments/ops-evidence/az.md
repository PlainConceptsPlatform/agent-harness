Azure DevOps data comes from the `az` CLI; a page fetch of dev.azure.com is denied (pc-system-reminders). If `az` is unavailable, skip publishing and report it; do not fail the pipeline unless the caller declared publishing a ship gate.

Publish one status comment for every manifest. A `blocked` or `failed` manifest must include its status and reason, never a success claim.

### Step 1 — Image hosting caveat

Azure DevOps discussion comments do not render an image from a repo blob URL the way GitHub does, and `az boards` cannot upload an attachment inline. Use text evidence and derive a commit-pinned repository URL from `git remote get-url origin` when possible. Otherwise include the committed asset path, branch, and SHA.

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

### Step 3 — Upsert the discussion comment on the work item (and the PR when provided)

`az boards work-item update --discussion` appends a comment and cannot edit one in place, so match on the status probe rather than the change id alone. Matching the change id alone leaves a stale `blocked` comment standing after a later run succeeds:

```bash
# Skip only when this exact status is already published for this change.
az boards work-item show --id {work-item-id} --query 'fields."System.History"' -o tsv 2>/dev/null | grep -q "pc-visual-evidence-status:{status}" \
  || az boards work-item update --id {work-item-id} --discussion "$BODY"
```

When an earlier comment carries this change id with a different status, this one supersedes it: open the body with `Supersedes the earlier evidence comment for this change.` so a reader can tell which is current.

When a PR number is provided, also add the same body as a PR thread comment (`az repos pr` thread APIs) if available.

- If a comment call fails: report it. Fail the run ONLY when publishing was declared a ship gate; otherwise continue.
