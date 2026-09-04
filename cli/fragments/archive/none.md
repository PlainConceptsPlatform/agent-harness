2. **Find the oldest unarchived change**

   List unarchived changes (top-level only, excludes `archive/`):

   ```bash
   find "$REPO_ROOT/openspec/changes" -mindepth 1 -maxdepth 1 -type d -not -name 'archive' | sort
   ```

   If empty, report a blocker and stop. Otherwise select the **oldest** change (by directory creation/sort order) as the candidate.

   This mode has no platform PR integration, so completion is judged from local state only. Do not look up remote PRs or work items.

3. **Confirm the candidate**

   Show the candidate (ID, title) and any other unarchived changes, then ask:

   ```text
   Oldest unarchived change found:
     ID: {change-id}
     Title: {title from proposal.md}

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

6. **Commit the archive**

   ```bash
   git add -A
   git commit -m "archive: {title} ({change-id})"
   ```

   No PR is created in this mode. Leave the `archive/{change-id}` branch for the user to merge or push manually if they choose.

   If work was stashed in step 1, restore it after the commit unless the user opts out.

7. **Report**

   Display:

   ```text
   Archive complete

     Change ID: {change-id}
     Title: {title}
     Archive branch: archive/{change-id}

     Documentation updates:
     - ARCHITECTURE.md: {count} changes applied
     - DESIGN.md: {count} changes applied
   ```

## Rules

- All OpenSpec paths resolve from `git rev-parse --show-toplevel`. Never use `/openspec/...`.
- Only process top-level directories in `$REPO_ROOT/openspec/changes/`; exclude `archive/`.
- Use change ID and slug only as search hints; do not assume the source branch name.
- The oldest unarchived change is the only candidate: never ask the user which change to archive.
- This mode has no GitHub or Azure DevOps integration. Never call `gh` or `az`, and never use browser tools or direct web requests for PR/work-item lookups.
- Never invent or guess PR, branch, or merge metadata.
