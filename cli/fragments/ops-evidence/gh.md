**ALL GitHub data MUST come from `gh` CLI. NEVER use webfetch, HTTP requests, or browser MCP tools for GitHub. If `gh` is unavailable, skip publishing (report it) — do not fail the pipeline over it unless the caller declared publishing a ship gate.**
Always pass `--repo {owner}/{repo}` (or `repos/{owner}/{repo}` for `gh api`) explicitly.

Publish one status comment for every manifest. A `blocked` or `failed` manifest must include its status and reason, never a success claim.

### Step 1 — Build commit-pinned repository links

An embedded image must be a raw URL pinned to the commit that actually contains it, and that commit must be pushed. For each asset in `evidence.json`:

```bash
SHA="$(git log -n 1 --format=%H -- '{asset-path}')"          # the commit that added this asset
[ -z "$SHA" ] && echo "asset not committed: {asset-path}" && exit-skip
gh api "repos/{owner}/{repo}/contents/{asset-path}?ref=$SHA" --silent   # 404 → not pushed yet → skip embedding
```

Build a blob link for every committed manifest and asset: `https://github.com/{owner}/{repo}/blob/{SHA}/{asset-path}`. Use the raw URL only for a verified embeddable image: `https://raw.githubusercontent.com/{owner}/{repo}/{SHA}/{asset-path}`. If verification fails, include the asset path and SHA as text; never post a dead link.

### Step 2 — Build the comment body with a stable marker (idempotent)

Prefix the body with a hidden marker so re-runs update the same comment instead of piling on:

```
<!-- pc-visual-evidence:{change-id} -->

Status: `{status}`

{reason?}

Manifest: {commit-pinned evidence.json link}

Assets: {commit-pinned asset links}

{prMarkdown}
```

### Step 3 — Upsert the comment on BOTH the issue and the PR

For each target number (the originating issue, and the PR number when provided), find an existing marked comment and PATCH it, else POST a new one:

```bash
# find existing
ID="$(gh api "repos/{owner}/{repo}/issues/{number}/comments" --paginate --jq \
  '.[] | select(.body | contains("<!-- pc-visual-evidence:{change-id} -->")) | .id' | head -1)"

if [ -n "$ID" ]; then
  gh api --method PATCH "repos/{owner}/{repo}/issues/comments/$ID" -f body="$BODY" --silent
else
  gh api --method POST  "repos/{owner}/{repo}/issues/{number}/comments" -f body="$BODY" --silent
fi
```

- Text-only (no verified image, or `default` mode / nothing pushed): drop the image lines, keep the summary (tasks N/N, verification result, commits).
- If a comment call fails: report it. Fail the run ONLY when the caller declared publishing a ship gate; otherwise continue.
