---
name: pc-repo-verify
description: Write a reproduction plan for the completed change as a journey of agent-browser waypoints stored with the change. Does not run checks, launch a browser, or take screenshots. Invoked by /repo-verify and the plan-goal pipeline.
license: MIT
---

# Repo Verify

Write the verification plan for the current branch's change. The checks gate lives in `pc-plan-apply` step 10 (lint, typecheck, test, build). This skill produces the reproduction plan instead: a journey through the new functionality with observation waypoints, written so a later agent-browser executor skill can follow it verbatim.

This skill never launches a browser, never takes a screenshot, never starts a server. It only reads the change and writes a plan file. It is the agent-executed counterpart to `pc-ops-evidence`, whose `capturePlan` stays the CI-side screenshot workflow.

Work only on the current branch: do not switch branches, push, create pull requests, or contact external platforms. Write the plan into the change directory; it is carried into the archive by `pc-plan-archive`.

## Step 1: Read the change

1. Resolve the change id from the caller (autonomous mode) or from the current branch's unarchived change under `openspec/changes/<change-id>/`. Read `proposal.md`, `tasks.md`, and `design.md` when present.
2. Read `.opencode/source-roots.json` when it exists; use its non-empty `roots` array to scope frontend source, otherwise use the repository root.
3. Inspect `git diff` against the branch base and the working tree for context on what changed.

## Step 2: Determine UI impact

Decide whether the change is reachable from something a user sees or does in the browser.

1. **Direct** — changed files include user-visible UI: `*.tsx`/`jsx`/`vue`/`svelte`, `*.css`/`scss`/`less`, pages, layouts, components, navigation, routes. The affected surfaces are the routes/components the diff touches.
2. **Indirect (backend-only diff, frontend-affected)** — the diff touches only API/backend code, but the changed contract is consumed by the frontend. Trace it: for every changed endpoint, route, handler, query, or exported function, search the frontend source roots for references to that name or path. If any reference exists, the frontend **is** affected. Map the surfaces (the routes/components that import or call the changed contract) and build the journey through them, treating the API change as an indirect UI change.
3. **None** — no path reaches the frontend. Write the stub plan (Step 3, `status: not-applicable`) and stop. Do not fabricate a journey.

Mixed or unknown counts as affected: be safe.

## Step 3: Write the plan

Write `verification-plan.md` into the change directory:

```
openspec/changes/<change-id>/verification-plan.md
```

The plan is written in agent-browser idiom so a future executor skill can follow it verbatim. Format:

```markdown
# verification-plan.md — <change-id>

environment:
  start: pnpm run dev
  url: http://localhost:3000
  login: mock-sso
  data: |
    <seed/data preconditions, or "none">

journey:
  - id: 1
    arrive:
      - agent-browser open http://localhost:3000/
      - agent-browser wait --load networkidle
    waypoint: wp-1-home
    capture: home
    expect: homepage renders; nav is visible

  - id: 2
    arrive:
      - agent-browser find text "Items" click
    waypoint: wp-2-items-list
    capture: items-list
    expect: the items list shows the seeded rows

  - id: 3
    arrive:
      - agent-browser find first ".item-row" click
      - agent-browser wait --load networkidle
    waypoint: wp-3-detail-before
    capture: detail-before
    expect: the item detail panel is open and shows the record

  - id: 4
    arrive:
      - agent-browser find role button click --name "Status"
    waypoint: wp-4-detail-active
    capture: detail-active
    expect: the status badge now reads "Active"
```

Replace the example routes, captions, locators, and expectations with the actual change. Locators must be agent-browser-native and stable: prefer `find role`, `find text`, `find label`, `find testid`; use CSS selectors only when no semantic locator exists. Use `wait --load networkidle` (or `wait <selector>` / `wait --text "<known>"`) so the executor reaches the state before observing.

### Waypoint rules

1. The first waypoint is always the baseline at `/`: `wp-1-home`, `capture: home`.
2. Place waypoints as a pre/post pair around the changed behavior — the state immediately before and immediately after the core change is exercised.
3. Every waypoint has a `waypoint:` id (`wp-<n>-<slug>`), a `capture:` id (kebab-case, unique), and an `expect:` line stating what must be observable there.
4. Dynamic data uses `sampleId: first` or `sampleId: any` in the `data:` block; locators that target a record resolve through it.
5. The number of waypoints is the minimum that reproduces and proves the behavior — not every screenshottable moment, just the meaningful observation points.

### When the change is not UI-reachable

Write the stub and stop:

```markdown
# verification-plan.md — <change-id>

status: not-applicable
reason: |
  Change is backend-only and no frontend code references the changed contract
  (<names>). No user-visible journey exists; the executor skill should skip.
```

Adapt the reason to the actual change. Do not invent a journey when Step 2 concluded `None`.

### Rules for writing

- This skill MUST NOT launch a browser, start the app, take screenshots, or run build/test/lint. Those belong elsewhere.
- Never commit, stage, or push verifications. The caller owns git.
- The plan file is the only artifact written. Do not modify the change's specs, tasks, or proposal.
- Keep locators stable and observable: prefer semantic locators over brittle CSS paths.

## Step 4: Result

Report one of:

- `PLAN_WRITTEN <change-id>` — a journey with waypoints was written to `verification-plan.md`.
- `STUB_WRITTEN <change-id>` — `status: not-applicable` stub written with a reason.
- `NOT WRITTEN` — hard blocker (unreadable change, missing change directory). Report the blocker and the exact next step.

A correct plan file written to the change directory is the success condition. Write a stub for non-UI changes; never skip writing the file.
