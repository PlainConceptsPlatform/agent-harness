# Simple mode: sequential in-session

When the plan lives in the Todo pane (from `/plan-quick`) and no OpenSpec change exists:

1. Read the task list from the Todo pane (the `pending` items created by `/plan-quick`).
2. Create a feature branch if not already on one: `git switch -c feature/{slug}`. (Skip when the caller passed `start_from: load-plan`.)
3. Work through tasks one at a time, in order, directly in this session:
   - Read the task text from the Todo item.
   - Mark it `in_progress` via `todowrite`.
   - Implement it (edit files, run commands as needed).
   - Mark it `completed` via `todowrite`.
   - Commit the change: `git add -A && git commit -m "task {id}: {summary}"`.
4. After all tasks are done, run the project's typecheck/build check if one exists. Fix any errors.
5. Report: tasks N/N completed, commits made, branch name.

Rules:
- Work in this session only. No subagent spawning.
- No OpenSpec commands.
- Keep each commit focused on one task.
- Use `todowrite` to track progress: `pending` -> `in_progress` -> `completed`.
- If a task is too complex or blocked, mark it `completed` with a note, and continue with the next.
