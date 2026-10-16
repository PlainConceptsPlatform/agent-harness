# Simple mode: sequential in-session

When the plan lives in the Todo pane (from `/plan-quick`) and no OpenSpec change exists:

1. Read the task list from the Todo pane (the `pending` items created by `/plan-quick`).
2. Create a feature branch if not already on one: `git switch -c feature/{slug}`. (Skip when the caller passed `start_from: load-plan`.)
3. Work through tasks one at a time, in order, directly in this session:
   - Read the task text from the Todo item.
   - Mark it `in_progress` via `todowrite`.
   - Implement it (edit files, run commands as needed).
   - Mark it `completed` via `todowrite`.
   - Commit the change: `git add <the paths this task wrote> && git commit -m "task {id}: {summary}"`. Unscoped staging is denied (`pc-system-reminders`).
4. After all tasks are done, run the project's verification (`pnpm verify` when package.json defines it, otherwise its typecheck/build check), then `node .opencode/scripts/check-diff.mjs`. Fix any errors until both exit 0. Anything changed to satisfy `check-diff` is a change: run the whole verification again afterwards, so the last run is on the tree you ship. Never delete a test that covers a branch the change added to fit the test budget; a complexity or coverage gate in CI measures it.
5. Report: tasks N/N completed, commits made, branch name.

Rules:
- Work in this session only. No subagent spawning.
- No OpenSpec commands.
- Keep each commit focused on one task.
- Use `todowrite` to track progress: `pending` -> `in_progress` -> `completed`.
- Never mark a task `completed` that you did not finish. Use `cancelled` with the reason and continue with the next; a false green is invisible to whoever reads the report.
