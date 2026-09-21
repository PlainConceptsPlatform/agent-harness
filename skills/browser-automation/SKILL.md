---
name: browser-automation
description: Reliable, composable browser automation using agent-browser. Use when capturing screenshots of a locally running app, clicking UI elements, reading page content, or automating browser interactions on localhost.
license: MIT
compatibility: Requires agent-browser CLI installed (Rust binary) and running.
metadata:
  author: copilots
  version: "2.0"
---

This skill operates on `localhost` URLs only. Screenshots, clicks, typing, scrolling, and reads on locally running apps are in scope. External services (github.com, dev.azure.com, npmjs.com, etc.) are out of scope for browser tools.

The only exception: when the user selects "Others (Browser)" as their backlog platform during onboarding, the `pc-userstory` skill may navigate to work item URLs the user explicitly provides. That is the sole case where external navigation is permitted, and only to URLs the user explicitly gives you.

## Best-practice workflow

1. Open the page: `agent-browser open <url>` (launches its own Chrome; reuses the running daemon)
2. Take a snapshot: `agent-browser snapshot` to get the accessibility tree with `@ref` handles
3. Interact by ref: `agent-browser click @e2`, `agent-browser fill @e3 "text"`
4. Wait when needed: `agent-browser wait --load networkidle` or `agent-browser wait <selector>`
5. Confirm the result with a fresh `snapshot`, `get text`, or `screenshot`

Refs like `@e2` come from the last snapshot and go stale after page changes: retake the snapshot after navigation or dynamic updates before reusing them. When a click fails because another element covers the target (consent banner, modal), dismiss or interact with the covering element, then take a fresh snapshot before retrying.

## Tool access

- MCP tools (inside OpenCode): `agent_browser_open`, `agent_browser_snapshot`, `agent_browser_click`, `agent_browser_fill`, `agent_browser_type`, `agent_browser_wait_for_selector`, `agent_browser_screenshot`, `agent_browser_eval`, `agent_browser_close` — configured in `opencode.jsonc` with `--tools core`
- CLI (any agent, any host): every command below works identically via bash
- Diagnose the install: `agent-browser doctor`

## Selecting elements

- Prefer refs from `snapshot` (`@e1`, `@e2`, ...) over CSS selectors
- CSS selectors also work: `agent-browser click "#submit"`, `agent-browser fill "#email" "text"`
- Semantic locators: `agent-browser find role button click --name "Submit"`, `find text "Sign In" click`, `find label "Email" fill "value"`, `find testid <id> click`
- Native selects: `agent-browser select <sel> <value>`

## Reading state

- `agent-browser get text <sel>` — text content of an element
- `agent-browser get value <sel>` — input value
- `agent-browser snapshot` — structured accessibility tree (preferred for parsing)
- `agent-browser screenshot [path]` — `--full` for full page, `--annotate` for numbered labels
- `agent-browser read` — agent-readable markdown of the active tab (no Chrome launch for URL reads)

## Tabs and sessions

- `agent-browser tab` lists tabs with stable `t1`, `t2` ids; `tab new --label <name>` and `tab <label>` switch
- `agent-browser close` closes the browser; `close --all` closes every session

## CLI-first debugging

- `agent-browser doctor` — diagnose install, Chrome, and daemon state
- `agent-browser console` — view console messages; `agent-browser errors` — uncaught exceptions
- `agent-browser eval "<js>"` — run JavaScript in the page
- `agent-browser network requests --filter api` — inspect tracked requests

## Troubleshooting

- Stale ref: take a fresh `snapshot` after any navigation or DOM change
- Covered click: the error names the covering element; dismiss it, re-snapshot, retry
- Selector fails: confirm the content exists with `agent-browser get text` or a snapshot before retrying
- Daemon or Chrome issues: run `agent-browser doctor`

## Scope

- Screenshots of locally running app on `localhost` URLs: in scope
- Click, type, scroll, read on `localhost` pages: in scope
- Navigate to work item URLs the user explicitly provides (when backlog platform is "Others (Browser)"): in scope
- Navigate to external services for non-work-item purposes: out of scope
- DevOps or GitHub CLI operations via browser tools: out of scope
- Reading or modifying production systems via browser tools: out of scope
