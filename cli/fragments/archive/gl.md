2. **Find the oldest change with a completed MR**

   List unarchived changes (top-level only, excludes `archive/`):

   ```bash
   find "$REPO_ROOT/openspec/changes" -mindepth 1 -maxdepth 1 -type d -not -name 'archive' | sort
   ```

   If empty, report a blocker and stop.

   List completed merge requests:

   ```bash
   glab mr list --repo {owner}/{repo} --merged --output json --jq 'sort_by(.merged_at) | .[] | {name: .title, sourceRefName: .source_branch, mergedAt: .merged_at, mergeRequestId: .iid}'
   ```

   Match each change to a completed MR using its ID and slug as search hints:
   - No match → skip (record as blocked: `no merged MR found`).
   - One match → eligible.
   - Multiple matches → ask the user which MR belongs to that change.

   If nothing is eligible, report a blocker and stop. Otherwise select the eligible change with the **oldest** MR `merged_at` as the candidate.

3. **Confirm the candidate**

   Show the candidate (ID, title, MR ID, merged date) and any blocked changes, then ask:

   ```text
   Oldest unarchived merged change found:
     ID: {change-id}
     Title: {title from resolved MR}
     MR ID: {iid}
     Merged: {merged_at}

   Proceed with archiving? [yes/no]
   ```

   Stop if the user does not confirm.

4. **Archive the change**

   ```bash
   git checkout -b archive/{change-id}
   ```

   Load `@openspec-archive-change` skill and follow it to archive the change.

5. **Update docs**

   Compare the archived change's specs against `ARCHITECTURE.md` and `DESIGN.md`. If updates are needed, show them and get user approval before applying.

6. **Create the archive MR**

   ```bash
   git add -A
   git commit -m "archive: {title} ({change-id})"
   git push origin archive/{change-id}

   glab mr create \
      --repo {owner}/{repo} \
      --source-branch "archive/{change-id}" \
      --target-branch "$DEFAULT_BRANCH" \
      --title "archive: {title} ({change-id})" \
      --description "Archive SDD artifacts for {change-id} after merge."
   ```

   If work was stashed in step 1, restore it after the MR is created unless the user opts out.

7. **Report**

   Display:

   ```text
   Archive complete

     Change ID: {change-id}
     Title: {title}
     Original MR: {original-mr-link}
     Archive MR: {archive-mr-link}

     Documentation updates:
     - ARCHITECTURE.md: {count} changes applied
     - DESIGN.md: {count} changes applied
   ```

## Rules

- All OpenSpec paths resolve from `git rev-parse --show-toplevel`. Never use `/openspec/...`.
- Only process top-level directories in `$REPO_ROOT/openspec/changes/`; exclude `archive/`.
- Use change ID and slug only as search hints; do not assume the source branch name.
- The oldest eligible merged change is the only candidate: never ask the user which change to archive (but do ask which MR if multiple match one change).
- Never proceed if the selected MR is not completed.
- Never use browser tools or direct web requests for GitLab. Use `glab` CLI only.
- Never invent or guess MR, branch, or merge metadata.
