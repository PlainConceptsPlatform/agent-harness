---
name: pc-guardrails-generic
description: Generic guardrails, foundational rules that all agents follow. Users add specialized guardrails skills for specific concerns. Covers secrets, code quality, security, tool usage, and engineer workflow.
license: MIT
---

## Transitive loads (optimization skills)

The marker sections below name the optimization skills this project selected. Load each one before doing any work: editing, shell and spawning stay blocked until every named skill that is installed has been loaded (pc-system-reminders).

## Secrets

- Treat `.env` files as write-only: write to them when configuring, read credentials from the environment or secret store at runtime.
- Keep credentials, API keys, and tokens out of logs and output.
- Stage secrets through environment variables or secret stores, committed only in encrypted or template form.

## Code

- Run tests before marking done.
- Run lint/build before pushing.
- Keep changes small and focused.
- Comments are for WHY, not WHAT. Use them only when the code does something non-obvious or the reason cannot be inferred from context. Keep comment ratio under 10%. If more than 10% of lines in a file are comments, refactor for clarity instead.
- Each file should have one clear responsibility. Split by domain or feature (e.g. `user-constants.ts`, `order-types.ts`, `auth-config.ts`) rather than creating catch-all files like `constants.js`, `types.ts`, `config.js`, or `utils.ts` that collect unrelated things. A file that imports from many unrelated modules is a sign it should be split.

## Temporary files

- Never write outside `$REPO_ROOT`, and never to an operating-system temporary directory: the next step and the next agent cannot see it, and nobody cleans it up. Scratch goes under `$REPO_ROOT/.opencode/.tmp/`, in a task-specific child directory when needed (enforced by pc-system-reminders).
- Keep final artifacts in their required repository path. Copy or move a scratch artifact into that path before reporting it.
- Remove scratch files when the task ends unless they are needed to diagnose a failure.

## Security

- Validate all inputs.
- Escape all outputs.
- Keep credentials in environment variables or secret stores, committed only in encrypted or template form.

## Communication

- Ask for clarification if unclear.
- Report blockers immediately.
- Show progress when asked.

<!-- PC-GUARDRAILS-RTK-START -->
<!-- PC-GUARDRAILS-RTK-END -->

<!-- PC-GUARDRAILS-CODEGRAPH-START -->
<!-- PC-GUARDRAILS-CODEGRAPH-END -->

<!-- PC-GUARDRAILS-MEMORY-START -->
<!-- PC-GUARDRAILS-MEMORY-END -->

<!-- PC-GUARDRAILS-SIMPLE-ENGLISH-START -->
<!-- PC-GUARDRAILS-SIMPLE-ENGLISH-END -->

<!-- PC-GUARDRAILS-HUMANIZER-START -->
<!-- PC-GUARDRAILS-HUMANIZER-END -->

## Engineer workflow (when spawned)

When the lead spawns you via the task tool, your assigned task IDs and text are already in your prompt:

1. Load every skill under your `## Abilities`, guardrails first, by calling the `skill` tool once per `@skill-name`. Editing, shell and spawning are blocked until you have (pc-system-reminders).
2. Gather context using the project-selected tools described above.
3. Implement your assigned tasks in dependency order. Edit only files within your assigned scope.
4. Run the project's tests/lint before marking done (see Code above).
5. Record the task result through the project-selected workflow.
6. Return a summary containing: task IDs done, files changed, tests/lint result, and any decisions made. Then you exit; you do not poll, claim, or wait for more work.
