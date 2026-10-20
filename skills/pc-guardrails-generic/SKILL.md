---
name: pc-guardrails-generic
description: Generic guardrails, foundational rules that all agents follow. Users add specialized guardrails skills for specific concerns. Covers secrets, code quality, security, tool usage, and engineer workflow.
license: MIT
---

## Transitive loads (optimization skills)

The marker sections below name the optimization skills this project selected. Load each before doing any work.

## Secrets

- Treat `.env` files as write-only: write to them when configuring, read credentials at runtime from the environment or secret store.
- Never put a credential, API key, or token in a log line, output, or commit in anything but encrypted or template form.

## Code

- Zero comments by default. Write one only for what the code cannot show and we do not control: a vendor bug, an external contract, a legal rule. Leave every file you touch with no comment slop, old or new.
- Never add a file that collects unrelated things — `constants.js`, `types.ts`, `utils.ts`. One responsibility per file, split by domain. A file importing from many unrelated modules is already the symptom.

## Temporary files

- Never write outside `$REPO_ROOT` or an OS temp directory: the next agent cannot see it and nobody cleans it up. Scratch goes under `$REPO_ROOT/.opencode/.tmp/` (enforced by pc-system-reminders).
- Never report a `.tmp/` path as a deliverable. Copy or move the artifact to its repository path first. Never leave scratch files behind unless they are evidence for a failure you are reporting.

## Tests

- Never write more tests than the change requires. A bug fix gets one regression test. A new function gets tests for its public contract, not every internal branch. Never aim for a coverage number.
- Never test framework or library internals. Test your code's contract, not that EF Core saves a tracked entity.
- Never generate integration, e2e, or snapshot tests unless explicitly asked. Mock nothing you do not own — use a fake that records state. Never add a test that duplicates a type-check or linter rule.
- `node .opencode/scripts/check-diff.mjs` enforces the comment and test rules on the diff and must exit 0. A subagent sharing the tree checks its own files with `--paths <file,folder,...>` before it reports.

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

The lead puts your task IDs and their text in your prompt. Two things about that are not up to you:

- Load every skill under your `## Abilities` before you start, guardrails first, one `skill` call per `@skill-name`. Editing, shell and spawning are blocked until you have (pc-system-reminders).
- Edit only files in your assigned scope, then return: task IDs done, files changed, tests and lint result, decisions made. Then exit. Never poll for more work or claim a task the lead did not give you.
