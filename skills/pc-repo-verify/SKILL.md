---
name: pc-repo-verify
description: Write the verification plan for the completed change, a journey through the new functionality as a fenced YAML block that the evidence workflow replays in headless Chromium after the pull request merges. Does not run checks, launch a browser, or take screenshots. Invoked by /repo-verify and the plan-goal pipeline.
license: MIT
---

# Repo Verify

Write the verification plan for the current branch's change. The checks gate lives in `pc-plan-apply` step 10 (lint, typecheck, test, build). This skill produces the reproduction plan instead: a journey through the new functionality with one screenshot per waypoint.

The plan is executed by a machine, not read by one. When the pull request merges, the evidence workflow (`evidence.yml` from `@plainconceptsplatform/workflows`) checks out the pull request head, starts the app, replays every step below in headless Chromium with no model in the loop, and archives one screenshot per waypoint on the pull request. A step it cannot follow is a screenshot of the wrong screen. Write every step so it can be followed literally from a freshly started app.

This skill never launches a browser, never takes a screenshot, never starts a server. It only reads the change and writes a plan file.

Work only on the current branch: do not switch branches, push, create pull requests, or contact external platforms. Write the plan into the change directory; it is carried into the archive by `pc-plan-archive`.

## Project environment

How this project's app starts, where it answers, how a person signs in locally, and what data a fresh start already has. Read it before writing a journey; it is the project's, and an update keeps it.

<!-- PC-PROJECT-ENVIRONMENT-START -->
- Start: `pnpm run dev` at the repository root brings up the whole stack with mock authentication.
- URL: `http://localhost:3000`.
- Sign-in: none recorded yet. Find the local sign-in (a mock account picker, a dev login button) in the source and write its steps into the first waypoint.
- Seeded data: none recorded yet. Create what the journey needs through the UI.
<!-- PC-PROJECT-ENVIRONMENT-END -->

## Step 1: Read the change

1. Resolve the change id from the caller (autonomous mode) or from the current branch's unarchived change under `openspec/changes/<change-id>/`. Read `proposal.md`, `tasks.md`, and `design.md` when present.
2. Read `.opencode/source-roots.json` when it exists; use its non-empty `roots` array to scope frontend source, otherwise use the repository root.
3. Inspect `git diff` against the branch base and the working tree for context on what changed.

## Step 2: Determine UI impact

Decide whether the change is reachable from something a user sees or does in the browser.

1. **Direct**: changed files include user-visible UI: `*.tsx`/`jsx`/`vue`/`svelte`, `*.css`/`scss`/`less`, pages, layouts, components, navigation, routes. The affected surfaces are the routes/components the diff touches.
2. **Indirect (backend-only diff, frontend-affected)**: the diff touches only API/backend code, but the changed contract is consumed by the frontend. Trace it: for every changed endpoint, route, handler, query, or exported function, search the frontend source roots for references to that name or path. If any reference exists, the frontend **is** affected. Map the surfaces (the routes/components that import or call the changed contract) and build the journey through them.
3. **None**: no path reaches the frontend. Write the stub plan (Step 3, `status: not-applicable`) and stop. Do not fabricate a journey.

Mixed or unknown counts as affected: be safe.

## Step 3: Write the plan

Write `verification-plan.md` into the change directory:

```
openspec/changes/<change-id>/verification-plan.md
```

Prose around the block is for people and is ignored by the replay. The replay reads the first fenced `yaml` block that holds a `journey`:

````markdown
# Verification plan: <change-id>

One or two sentences on what the journey proves.

```yaml
url: http://localhost:3000
journey:
  - capture: home
    expect: signed in, the item list is the home page
    steps:
      - open: /
      - click: { role: button, name: Alice Admin }
      - wait: { role: heading, name: Items }

  - capture: detail-before
    expect: the detail panel shows the item without a status badge
    steps:
      - click: { text: Seeded item }
      - wait: { load: networkidle }

  - capture: detail-active
    expect: the status badge reads Active
    steps:
      - click: { role: button, name: Activate }
      - wait: { text: Active }
```
````

### Keys

- `url`: where the app answers once started, from the project environment above. Relative `open:` paths resolve against it.
- `start` (optional): the command that starts the app, only when it is not the project's default.
- `viewport` (optional): `1280x800` unless the change is about another size.
- `journey`: the waypoints, in order, in one browser tab. Each has a `capture` (kebab-case, unique), an `expect` (what is visible in the screenshot), and the `steps` that get there from the previous waypoint.

### Steps

Each step is a map with exactly one action:

| Step | Does |
|---|---|
| `open: /path` | navigate (relative to `url`, or a full URL) |
| `click: <locator>` | click; add `button: right` inside the locator for a context menu |
| `dblclick: <locator>`, `hover: <locator>`, `check: <locator>`, `uncheck: <locator>` | as named |
| `fill: { <locator>, value: text }` | replace the field's text |
| `select: { <locator>, value: option }` | choose an option |
| `press: Enter` or `press: { <locator>, key: Enter }` | press a key |
| `wait: <locator>` | until the element is visible |
| `wait: { text: Saved }` | until the text is visible |
| `wait: { load: networkidle }` | until the page settles; never a failure on its own |
| `wait: { url: /items/ }` | until the address contains it |
| `wait: { ms: 500 }` | a fixed pause, only for an animation with nothing to wait on |

A locator is one of `{ role: button, name: Save }`, `{ text: Save }`, `{ label: Name }`, `{ placeholder: Search }`, `{ testid: save }`, `{ alt: Logo }`, `{ title: Close }`, or `{ css: ".row" }`, optionally with `nth: 1` or `last: true`. The first match is used.

### Rules

1. The first waypoint starts with `open` and signs in, using the sign-in from the project environment. The replay starts from a freshly started app with nothing in the browser.
2. Everything the journey needs that a fresh start does not have, create through the UI in the steps (a record to open, a setting to change). Never assume data from a developer's machine.
3. Place waypoints as a pre/post pair around the changed behavior: the state immediately before and immediately after the core change is exercised.
4. Use the minimum number of waypoints that reproduces and proves the behavior, normally three to six.
5. Locators name what a person sees: prefer `role` with `name`, then `label`, `text`, `testid`. Copy visible text from the source's default-language strings exactly, not from memory. Use `css` only when nothing semantic exists.
6. Wait for the state before each capture: end every waypoint's steps with a `wait` on something the screenshot is meant to show.
7. Only the steps above replay. Network inspection, console reads, and API calls do not; prove those in tests, not here.

### When the change is not UI-reachable

Write the stub and stop:

````markdown
# Verification plan: <change-id>

```yaml
status: not-applicable
reason: Backend-only change; no frontend code references the changed contract (<names>).
```
````

Adapt the reason to the actual change. Do not invent a journey when Step 2 concluded `None`.

### Rules for writing

- This skill MUST NOT launch a browser, start the app, take screenshots, or run build/test/lint. Those belong elsewhere.
- Never commit, stage, or push. The caller owns git.
- The plan file is the only artifact written. Do not modify the change's specs, tasks, or proposal.
- When the project environment above says `none recorded yet` and you found the real sign-in or start command in the source, say so in the result so a person can record it there.

## Step 4: Result

Report one of:

- `PLAN_WRITTEN <change-id>`: a journey with waypoints was written to `verification-plan.md`.
- `STUB_WRITTEN <change-id>`: `status: not-applicable` stub written with a reason.
- `NOT WRITTEN`: hard blocker (unreadable change, missing change directory). Report the blocker and the exact next step.

A correct plan file written to the change directory is the success condition. Write a stub for non-UI changes; never skip writing the file.
