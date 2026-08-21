2. **Find the oldest change with a completed PR**

   List unarchived changes (top-level only, excludes `archive/`):

   ```bash
   find "$REPO_ROOT/openspec/changes" -mindepth 1 -maxdepth 1 -type d -not -name 'archive' | sort
   ```

   If empty, report a blocker and stop.

   List completed PRs:

   ```bash
   az repos pr list --repository {repo} --status completed --query "sort_by(@, &closedDate)[].{name:title,sourceRefName:sourceRefName,closedDate:closedDate,pullRequestId:pullRequestId}"
   ```

   Match each change to a completed PR using its ID and slug as search hints:
   - No match → skip (record as blocked: `no merged PR found`).
   - One match → eligible.
   - Multiple matches → ask the user which PR belongs to that change.

   If nothing is eligible, report a blocker and stop. Otherwise select the eligible change with the **oldest** PR `closedDate` as the candidate.

3. **Confirm the candidate**

   Show the candidate (ID, title, PR ID, merged date) and any blocked changes, then ask:

   ```text
   Oldest unarchived merged change found:
     ID: {change-id}
     Title: {title from resolved PR}
     PR ID: {pullRequestId}
     Merged: {closedDate}

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

6. **Create the archive PR**

   ```bash
   git add -A
   git commit -m "archive: {title} ({change-id})"
   git push origin archive/{change-id}

   az repos pr create \
     --repository {repo} \
     --source-branch refs/heads/archive/{change-id} \
     --target-branch "refs/heads/$DEFAULT_BRANCH" \
     --title "archive: {title} ({change-id})" \
     --description "Archive SDD artifacts for {change-id} after merge of {sourceRefName}." \
     --auto-complete
   ```

   If work was stashed in step 1, restore it after the PR is created unless the user opts out.

7. **Report**

   Display:

   ```text
   Archive complete

     Change ID: {change-id}
     Title: {title}
     Original PR: {original-pr-link}
     Archive PR: {archive-pr-link}

     Documentation updates:
     - ARCHITECTURE.md: {count} changes applied
     - DESIGN.md: {count} changes applied
   ```

## Rules

- All OpenSpec paths resolve from `git rev-parse --show-toplevel`. Never use `/openspec/...`.
- Only process top-level directories in `$REPO_ROOT/openspec/changes/`; exclude `archive/`.
- Use change ID and slug only as search hints; do not assume the source branch name.
- The oldest eligible merged change is the only candidate: never ask the user which change to archive (but do ask which PR if multiple match one change).
- Never proceed if the selected PR is not completed.
- Never use browser tools or direct web requests for Azure DevOps. Use `az` CLI only.
- Never invent or guess PR, branch, or merge metadata.
