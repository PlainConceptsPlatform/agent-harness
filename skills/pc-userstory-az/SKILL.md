---
name: pc-userstory
description: Parse Azure DevOps user story URL and create OpenSpec change. Use when user provides an Azure DevOps URL.
license: MIT
compatibility: Requires openspec CLI and Azure CLI.
metadata:
  author: copilots
  version: "3.1"
---

Turn an Azure DevOps work item URL into an OpenSpec change, then hand the change to `pc-plan-propose`.

## Rules

- Work item data comes from `az`, never from a page fetch or a browser (denied by `pc-system-reminders`). An `az` that cannot reach the org is a blocker to report.
- Never load `pc-plan-apply` until the user has said yes.

## Contracts

The ID is in the URL: `?workitem=193208` or `/workitems/edit/193208` both give `193208`.

```bash
az boards work-item show --id 193208
```

That relies on the configured defaults, which is the one piece of setup this skill needs:

```bash
az devops configure --defaults organization=https://dev.azure.com/{org} project={project}
```

Without them every command needs `--organization`. A PAT with Work Items (Read and Write) and Code (Read and Write) comes from `https://dev.azure.com/{org}/_usersSettings/tokens`.

From the JSON take `fields.System.Title`, `fields.System.Description` (often HTML, strip the tags), `fields.System.WorkItemType`, `fields.System.IterationPath`, `fields.System.State` and `fields.System.AcceptanceCriteria` when it is there.

```bash
openspec new change "us-{id}-{slug}"
```

Screenshots live in the change folder, `openspec/changes/{change-name}/images/{name}.png`. Embedding one uses the `_apis/git/repositories` URL, since `_git/` returns HTML: `https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/items?path=openspec/changes/{change}/images/{file}.png&versionType=branch&version={branch}&api-version=7.1`

Report:

```
## User Story Parsed

Work Item: #{id}
Title: {title}
Type: User Story
Iteration: {sprint}
State: {state}

Change Created: us-{id}-{slug}
```

Then load `pc-plan-propose` (interactive) and, once it returns, ask:

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
