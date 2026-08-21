**Browser MCP tools are FORBIDDEN for all Azure DevOps operations. Use `az boards` CLI only. If `az` is unavailable, skip publishing (report it) — do not fail the pipeline unless the caller declared publishing a ship gate.**

Publish one status comment for every manifest. A `blocked` or `failed` manifest must include its status and reason, never a success claim.

### Step 1 — Image hosting caveat

Azure DevOps discussion comments do not render an image from a repo blob URL the way GitHub does, and `az boards` cannot upload an attachment inline. Use text evidence and derive a commit-pinned repository URL from `git remote get-url origin` when possible. Otherwise include the committed asset path, branch, and SHA.

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

### Step 3 — Upsert the discussion comment on the work item (and the PR when provided)

`az boards work-item update --discussion` appends a comment; to stay idempotent, first read existing discussion comments and skip if one already carries the marker for this change id, otherwise post:

```bash
# best-effort existing-comment check via the work-item comments API
az boards work-item show --id {work-item-id} --query 'fields."System.History"' -o tsv 2>/dev/null | grep -q "pc-visual-evidence:{change-id}" \
  || az boards work-item update --id {work-item-id} --discussion "$BODY"
```

When a PR number is provided, also add the same body as a PR thread comment (`az repos pr` thread APIs) if available.

- If a comment call fails: report it. Fail the run ONLY when publishing was declared a ship gate; otherwise continue.
