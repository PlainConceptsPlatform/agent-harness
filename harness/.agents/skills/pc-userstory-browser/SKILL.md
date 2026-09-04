---
name: pc-userstory
description: Parse work item from any URL using browser automation. Use when user provides a URL that doesn't match GitHub/Azure/Jira CLI platforms, or when backlog platform is 'browser'.
license: MIT
compatibility: Requires opencode-browser extension and openspec CLI.
metadata:
  author: copilots
  version: "1.0"
---

This skill is used when the backlog platform is set to "Others (Browser)": when there is no CLI integration for the backlog system, or the user doesn't have API tokens. Work items are read directly from the web page using the opencode-browser plugin.

This skill overrides the `browser-automation` skill's external navigation restriction, but only for URLs the user explicitly provides as work items. Navigate only to URLs the user gives you.

## Prerequisites

- opencode-browser extension installed and running (installed during onboarding)
- The user must be authenticated to the backlog system in their browser (e.g. logged into Azure DevOps, Jira, Trello, Linear, etc.)

## Steps

1. **Extract the URL** from the user's message
   - The user provides a direct URL to a work item, issue, ticket, or PBI
   - Examples: `https://dev.azure.com/org/project/_workitems/edit/123`, `https://linear.app/team/issue/ENG-123`, `https://trello.com/c/abc123`, `https://your-tool.com/ticket/456`

2. **Navigate to the URL**
   ```bash
   browser_open_tab url="https://the-url-the-user-provided"
   ```

3. **Wait for the page to load**
   ```bash
   browser_wait ms=3000
   ```

4. **Read the work item content**
   ```bash
   browser_query mode="page_text"
   ```

   Also try to get structured content:
   ```bash
   browser_snapshot
   ```
   The accessibility snapshot often reveals the work item title, description, and fields more precisely than raw page text.

5. **Parse work item fields**

   From the page text and/or snapshot, extract:
   - Title/Summary: usually the main heading or the `<h1>` / page title
   - Description: the body text, acceptance criteria, or "Definition of Done" section
   - ID/Key: the work item ID from the URL or page (e.g. `123`, `ENG-123`)
   - Status: if visible (e.g. "To Do", "In Progress", "Active")
   - Assignee: if visible
   - Priority: if visible
   - Labels/Tags: if visible

   If the page is a SPA that loads content dynamically:
   - Wait longer (`browser_wait ms=5000`)
   - Use `browser_query` with `mode=page_text` after the wait
   - Try `browser_snapshot` which may capture more structured content

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
- Use `browser_snapshot` to get structured accessibility tree data

## Rules

- Navigate only to URLs the user explicitly provides. Never guess or browse randomly.
- The user must already be authenticated in their browser to the backlog system.
- If the page requires login and the user isn't authenticated, tell them to log in via their browser and retry.
- For GitHub/Azure/Jira URLs when the CLI is configured for those platforms, use the CLI-based skill instead (faster, more reliable, no browser needed).
- This skill is read-only: no clicking buttons, no changing status.
- Browser is a backlog-only platform: it has no PR or repo integration. PR creation uses the repo platform configured separately.
