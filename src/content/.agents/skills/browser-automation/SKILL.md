---
name: browser-automation
description: Reliable, composable browser automation using OpenCode Browser primitives. Use when capturing screenshots of a locally running app, clicking UI elements, reading page content, or automating browser interactions on localhost.
license: MIT
compatibility: Requires opencode-browser extension installed and running.
metadata:
  author: copilots
  version: "1.0"
---

This skill operates on `localhost` URLs only. Screenshots, clicks, typing, scrolling, and queries on locally running apps are in scope. External services (github.com, dev.azure.com, npmjs.com, etc.) are out of scope for browser tools.

The only exception: when the user selects "Others (Browser)" as their backlog platform during onboarding, the `ob-userstory` skill may navigate to work item URLs the user explicitly provides. That is the sole case where external navigation is permitted, and only to URLs the user explicitly gives you.

## Best-practice workflow

1. Inspect tabs with `browser_get_tabs`
2. Open new tabs with `browser_open_tab` when needed
3. Navigate with `browser_navigate` if needed
4. Wait for UI using `browser_query` with `timeoutMs`
5. Discover candidates using `browser_query` with `mode=list`
6. Click, type, or select using `index`
7. Confirm using `browser_query` or `browser_snapshot`

## CLI-first debugging

- List all available tools: `npx @different-ai/opencode-browser@4.6.1 tools`
- Run one tool directly: `npx @different-ai/opencode-browser@4.6.1 tool browser_status`
- Pass JSON args: `npx @different-ai/opencode-browser@4.6.1 tool browser_query --args '{"mode":"page_text"}'`
- Run smoke test: `npx @different-ai/opencode-browser@4.6.1 self-test`
- After `update`, reload the unpacked extension in `chrome://extensions`

## Selecting options

- Use `browser_select` for native `<select>` elements
- Prefer `value` or `label`; use `optionIndex` when needed
- Example: `browser_select({ selector: "select", value: "plugin" })`

## Query modes

- `text`: read visible text from a matched element
- `value`: read input values
- `list`: list many matches with text/metadata
- `exists`: check presence and count
- `page_text`: extract visible page text

## Opening tabs

- Use `browser_open_tab` to create a new tab, optionally with `url` and `active`
- Example: `browser_open_tab({ url: "https://example.com", active: false })`

## Troubleshooting

- If a selector fails, run `browser_query` with `mode=page_text` to confirm the content exists
- Use `mode=list` on broad selectors (`button`, `a`, `*[role="button"]`, `*[role="listitem"]`) and choose by index
- For inbox/chat panes, try text selectors first (`text:Subject line`) then verify selection with `browser_query`
- For scrollable containers, pass both `selector` and `x`/`y` to `browser_scroll` and then verify `scrollTop`

## Scope

- Screenshots of locally running app on `localhost` URLs: in scope
- Click, type, scroll, query on `localhost` pages: in scope
- Navigate to work item URLs the user explicitly provides (when backlog platform is "Others (Browser)"): in scope
- Navigate to external services for non-work-item purposes: out of scope
- DevOps or GitHub CLI operations via browser tools: out of scope
- Reading or modifying production systems via browser tools: out of scope
