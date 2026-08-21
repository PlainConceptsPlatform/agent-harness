---
name: pc-repo-verify
description: Verify and repair current-branch changes using applicable fullstack engineer abilities, project checks, and dependency rules. Invoked by /repo-verify and the plan-goal pipeline.
license: MIT
---

# Repo Verify

Verify the current branch before it is archived, shipped, or handed to an external automation gate. Work only on the current branch: do not switch branches, push, create pull requests or backlog items, or contact external platforms.

## Step 1: Load verification rules

1. Read `.opencode/agents/fullstack-engineer.md`.
2. Parse every `@skill-name` in its `## Abilities` section.
3. Load every listed skill, guardrails first. A missing referenced skill is a verification failure; report it and do not claim `VERIFIED`.

## Step 2: Determine changed scope

1. Read `.opencode/source-roots.json` when it exists. Use its non-empty `roots` array; otherwise use the repository root.
2. Inspect `git diff` against the branch base and the working tree. Map every changed path to a configured root and discovered project.
3. Discover every project in every configured source root. Read each project's manifest, scripts, test configuration, CI configuration, and applicable guardrail instructions.
4. Build a check matrix. Include every discovered project's repository-defined immutable dependency install or restore command, build command, and test command, even when that project is untouched. Add changed-scope lint, typecheck, migration, generated-artifact, documentation, evidence, and required repository-wide checks from loaded guardrails.

## Step 3: Verify and repair

Run every discovered project's repository-defined immutable dependency install or restore command, build command, and test command. Run the changed-scope lint, typecheck, migration, generated-artifact, documentation, and evidence checks. A project without one of those commands is the only allowed skip, and the report must name the missing command.

When a dependency manifest changes, require its ecosystem lockfile to change when the package manager uses one. The dependency install or restore command must validate that lockfile without mutating it.

When a check fails, repair only the current branch's relevant files and rerun the failed check. Continue until every applicable check passes or a hard blocker prevents progress. Never hide a failure by deleting tests, weakening checks, or reverting requested work.

## Step 4: Result

Report a check matrix with command, affected project, result, and skip reason where applicable. Report `VERIFIED` only when every applicable check passed, every dependency change has consistent lockfiles, and no required ability is missing. Otherwise report `NOT VERIFIED`, the blockers, and the exact next command.
