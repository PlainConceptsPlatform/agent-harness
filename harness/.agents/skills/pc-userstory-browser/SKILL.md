---
name: pc-userstory
description: Parse work item from any URL using browser automation. Use when user provides a URL that doesn't match GitHub/Azure/Jira CLI platforms, or when backlog platform is 'browser'.
license: MIT
compatibility: Requires agent-browser CLI installed and openspec CLI.
metadata:
  author: copilots
  version: "2.0"
---

This skill is used when the backlog platform is set to "Others (Browser)": when there is no CLI integration for the backlog system, or the user doesn't have API tokens. Work items are read directly from the web page using agent-browser.

This skill overrides the `browser-automation` skill's external navigation restriction, but only for URLs the user explicitly provides as work items. Navigate only to URLs the user gives you.

## Prerequisites

- agent-browser installed (installed during onboarding) — verify with `agent-browser doctor`
- An authenticated session for the backlog system:
  - agent-browser runs its own Chrome, not the user's daily browser. Login state persists per session via `--session <slug> --restore`: log in once, and later runs restore cookies automatically.
  - On first use, the user logs in manually in the opened window; state is saved on close and auto-restored afterwards.

## Steps

1. **Extract the URL** from the user's message
   - The user provides a direct URL to a work item, issue, ticket, or PBI
   - Examples: `https://dev.azure.com/org/project/_workitems/edit/123`, `https://linear.app/team/issue/ENG-123`, `https://trello.com/c/abc123`, `https://your-tool.com/ticket/456`

2. **Open the URL in a persistent session**
   ```bash
   agent-browser --session backlog --restore open "https://the-url-the-user-provided"
   ```

3. **Wait for the page to load**
   ```bash
   agent-browser wait --load networkidle
   ```
   Prefer load-state waits over fixed sleeps; for SPAs that render after idle, add `agent-browser wait --text "<known heading>"` when a stable string is known.

4. **Read the work item content**
   ```bash
   agent-browser snapshot
   ```
   The accessibility tree with `@ref` handles usually reveals the work item title, description, and fields more precisely than raw page text. Also useful:
   ```bash
   agent-browser read           # agent-readable text of the active tab
   agent-browser get text "h1"  # the heading, when present
   ```

5. **Parse work item fields**

   From the snapshot and/or text, extract:
   - Title/Summary: usually the main heading or the `<h1>` / page title
   - Description: the body text, acceptance criteria, or "Definition of Done" section
   - ID/Key: the work item ID from the URL or page (e.g. `123`, `ENG-123`)
   - Status: if visible (e.g. "To Do", "In Progress", "Active")
   - Assignee: if visible
   - Priority: if visible
   - Labels/Tags: if visible

   If the page is a SPA that loads content dynamically:
   - Wait for load state again (`agent-browser wait --load networkidle`)
   - Take a fresh `snapshot` after the wait
   - `agent-browser get url` confirms you are still on the work item

   If a login page appears instead, the session is not authenticated: tell the user to log in manually in the opened browser window, then retry from step 2 with the same `--session backlog --restore` (the login is saved for future runs).

6. **Create OpenSpec Change**
   ```bash
   openspec new change "{slug-from-title}"
   ```

   Write `proposal.md` with:
   - Title: the work item title from the page
   - Context: mention the source URL and the work item ID
   - Requirements: extracted from description and acceptance criteria
   - Scope: what's in/out based on the ticket

7. **Hand off to proposal.** Load the `pc-plan-propose` skill (interactive mode) to generate the proposal, specs, and tasks. After it completes, call the `question` tool:

   ```json
   {
     "questions": [
       {
         "header": "Ready to implement",
         "question": "Ready to implement?",
         "options": [
           { "label": "yes", "description": "Load the pc-plan-apply skill to start implementation." },
           { "label": "no", "description": "Stop here. You can run /plan-apply later." }
         ]
       }
     ]
   }
   ```

   Wait for confirmation before loading `pc-plan-apply`.

## Working with common backlog tools

### Azure DevOps (browser fallback)
- URL: `https://dev.azure.com/{org}/{project}/_workitems/edit/{id}`
- Title: visible in the work item header
- Description: "Description" field section
- Acceptance Criteria: "Acceptance Criteria" field section
- State: visible in the top-right area

### Linear
- URL: `https://linear.app/{team}/issue/{key}`
- Title: the issue title
- Description: the issue body
- Status: visible as a dropdown

### Jira (browser fallback)
- URL: `https://yoursite.atlassian.net/browse/{key}`
- Title: the issue summary
- Description: the description field
- Status: visible in the status badge

### Trello
- URL: `https://trello.com/c/{short-id}`
- Title: the card title
- Description: the card description
- Labels: visible as colored badges

### Other tools (generic)
- Look for `<h1>` or page title for the work item title
- Look for the main content area for description
- Use `agent-browser snapshot` to get structured accessibility tree data

## Rules

- Navigate only to URLs the user explicitly provide. Never guess or browse randomly.
- Reuse the `backlog` session (`--session backlog --restore`) so login state persists across runs.
- If the page requires login and the session is not authenticated, tell them to log in via the opened browser window and retry.
- For GitHub/Azure/Jira URLs when the CLI is configured for those platforms, use the CLI-based skill instead (faster, more reliable, no browser needed).
- This skill is read-only: no clicking buttons, no changing status.
- Browser is a backlog-only platform: it has no PR or repo integration. PR creation uses the repo platform configured separately.
