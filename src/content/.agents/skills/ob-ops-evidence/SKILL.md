---
name: ob-ops-evidence
description: Writes a capturePlan in evidence.json for the Visual Evidence CI workflow to execute on a runner with Docker and Chrome access. Load after a change is implemented. Invoked by /ops-evidence and the plan-goal pipeline.
license: MIT
---

# Ops Evidence

Write a capture plan so the Visual Evidence CI workflow can capture screenshots on a runner with full Docker and Chrome access.

The agent runs inside the awf sandbox where Docker-in-Docker is unsupported and headless Chromium's sandbox is blocked by the container security policy. The agent cannot capture screenshots itself. Instead, it analyzes the diff and writes a `capturePlan` in `evidence.json`. A separate CI workflow executes the plan.

## Convention

Every platform project has `pnpm run dev` at root that starts the **full stack** (database + API + web). The app runs with mock auth in development mode (no real authentication needed). This is the only contract — no per-project evidence harness, fixture apps, or scenario registries.

## Input

The caller provides (all optional):
- change id: locates `openspec/changes/{change-id}/` (or the archived `archive/*{change-id}/`).
- issue / work-item ref and PR number: where to publish.
- output mode (`default` / `push` / `pr`): whether the branch was pushed.
- operation: `capture` (default), `publish`, or `both`.

## Part 1: Capture (operation: capture / both)

**Step 1: Decide whether evidence is required.** Inspect the change's diff:
- Required when changed files include user-visible UI: `*.tsx/jsx/vue/svelte`, `*.css/scss/less`, pages, layouts, components, navigation.
- Skipped when docs-only, internal refactor, dependency-only, test-only, backend-only.
- Mixed or unknown: required (be safe).

If skipped: write `evidence.json` with `status: "skipped"` and reason. Done.

**Step 2: Discover routes from git diff.** Parse changed files to determine which routes to screenshot:
- `pages/**/*.tsx` or `app/**/page.tsx` → extract the route path
- `features/**/*.tsx` or `components/**/*.tsx` → screenshot the homepage and any routes that import the changed component
- If no routes found → screenshot `/` only
- Always include `/` (homepage) as a baseline

**Step 3: Write `evidence.json` with `capturePlan`.** The agent never attempts to start the app stack or launch a browser — those always fail inside the awf sandbox. Instead, write a `capturePlan` immediately.

### The `capturePlan` schema

```
capturePlan:
  routes:           # Array of route objects to screenshot (at minimum [{ path: "/" }])
    - path: string  # URL path, e.g. "/quotes/:id"
      sampleId:     # string | "first" | "any" — how to resolve dynamic segments
      caption:      # string — human-readable description of what this screenshot shows
  viewports:        # Array of viewport objects
    - width: number
      height: number
      label: string # "desktop" | "mobile" | custom
  requireApi:       # boolean — true when the route needs the backend API running
  requireLogin:     # boolean — true when the route needs authentication
  loginMethod:      # string — "mock-sso" | "none" | custom method identifier
  reason:           # string — why evidence was blocked and what the screenshots should show
```

### Rules for writing capturePlan

1. `routes` MUST always include `{ path: "/", caption: "Homepage" }` as the first entry.
2. Every additional route discovered from the diff goes after the homepage entry.
3. `sampleId: "first"` means the CI workflow should use the first record returned by the API (e.g. the first quote from the seed data). `sampleId: "any"` means any valid ID.
4. `requireApi` is `true` when any route needs the backend to return data. It is `false` only for purely static pages (login, not-found).
5. `requireLogin` is `true` when any route needs authentication. For dev mode with mock auth, `loginMethod` is `"mock-sso"`.
6. `reason` should explain both WHY capture was blocked and WHAT the screenshots should show once captured.

### Example `evidence.json`

```json
{
  "version": 1,
  "changeId": "currency-in-project-details",
  "required": true,
  "status": "blocked",
  "assets": [],
  "capturePlan": {
    "routes": [
      { "path": "/", "sampleId": "any", "caption": "Homepage / accounts list" },
      { "path": "/quotes/:id", "sampleId": "first", "caption": "Quote editor with currency selector in ProjectDetailsCard" }
    ],
    "viewports": [
      { "width": 1280, "height": 720, "label": "desktop" },
      { "width": 375, "height": 667, "label": "mobile" }
    ],
    "requireApi": true,
    "requireLogin": true,
    "loginMethod": "mock-sso",
    "reason": "Currency selector moved from editor body into ProjectDetailsCard; visual change in quote editor page."
  },
  "reason": "Visual evidence cannot be captured inside the awf sandbox (Docker-in-Docker unsupported, headless Chromium sandbox blocked). A capturePlan has been written for the Visual Evidence CI workflow.",
  "prMarkdown": "## Evidence\n\nVisual evidence for this change is **blocked** in this agent run. A `capturePlan` has been written to `evidence.json` — the Visual Evidence CI workflow will execute it on a runner with full Docker and Chrome access.\n\nAutomated verification that did run:\n- Lint: clean\n- Tests: all pass\n- Build: success"
}
```

### When evidence is not required

If evidence is skipped (no UI files changed), write without a `capturePlan`:

```json
{
  "version": 1,
  "changeId": "{change-id}",
  "required": false,
  "status": "skipped",
  "assets": [],
  "reason": "No user-visible UI files changed in this PR.",
  "prMarkdown": "## Evidence\n\nSkipped: no user-visible UI changes."
}
```

Capture never commits, stages, or pushes. The caller owns git.

## Part 2: Publish (operation: publish / both)

Preconditions:
- An issue/PR number was provided. Else skip.
- Image URLs resolve only if the branch was pushed (`pr`/`push` modes).
- Backlog platform from `.opencode/opencode-onboard.json`; `none` means skip.

<!-- OB-PLATFORM-EVIDENCE-START -->
<!-- OB-PLATFORM-EVIDENCE-END -->

## Report

One block: the `status` (passed/skipped/failed/blocked) and why; capturePlan written or why not. Never present a blocked capture as passed.
