---
name: pc-ops-ship
description: Create a pull request for the current feature branch, with screenshots if UI changed. Load when shipping a finished feature branch. Invoked by the /ops-ship command and the plan-goal pipeline (pr mode).
license: MIT
---

# Ops Ship

## Input

The caller provides (all optional):
- PR title and body. When absent, derive them from the change context (change id, tasks completed, commit list).
- The base branch. When absent, resolve the default branch as shown in the platform steps below.

## Before opening

Run the project's verification (`pnpm verify` when package.json defines it) and `node .opencode/scripts/check-diff.mjs` on the branch as it will be pushed. If any commit landed after the last passing run, run both again. Do not open the pull request while either fails, and paste the verification summary into the body: a body that says "lint clean" without the output is how a formatting error reached CI.

Repo platform is set in `.opencode/harness.json` `platform.repo`. The platform-specific content below is injected by the CLI during onboarding.

<!-- PC-PLATFORM-SHIP-START -->
<!-- PC-PLATFORM-SHIP-END -->
