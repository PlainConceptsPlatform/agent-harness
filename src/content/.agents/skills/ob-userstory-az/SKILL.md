---
name: ob-userstory
description: Parse Azure DevOps user story URL and create OpenSpec change. Use when user provides an Azure DevOps URL.
license: MIT
compatibility: Requires openspec CLI and Azure CLI.
metadata:
  author: copilots
  version: "3.1"
---

Use `az` CLI for all Azure DevOps operations. Browser MCP tools are out of scope for this skill.

## Azure CLI Setup (One-Time)

```bash
az config set extension.dynamic_install_allow_preview=true
az extension add --name azure-devops
az login
az devops login --organization https://dev.azure.com/{org}
az devops configure --defaults organization=https://dev.azure.com/{org} project={project}
```

The `configure --defaults` line is required: every command below relies on the default org/project instead of passing `--organization`.

PAT Token: go to `https://dev.azure.com/{org}/_usersSettings/tokens`. Create with scopes: Work Items (Read and Write) and Code (Read and Write).

## Steps

1. **Extract Work Item ID** from URL
   - `?workitem=193208` -> ID: 193208
   - `/workitems/edit/193208` -> ID: 193208

2. **Fetch Work Item**
   ```bash
   az boards work-item show --id 193208
   ```
   Uses the default org, no `--organization` flag needed.

3. **Extract Key Fields** from JSON response:
   - `fields.System.Title` -> Title
   - `fields.System.Description` -> Description (may be HTML, strip tags)
   - `fields.System.WorkItemType` -> Type
   - `fields.System.IterationPath` -> Sprint
   - `fields.System.State` -> State
   - `fields.System.AcceptanceCriteria` -> AC (if present)

4. **Create OpenSpec Change**
   ```bash
   openspec new change "us-{id}-{slug}"
   ```

5. **Hand off to proposal.** Load the `ob-plan-propose` skill (interactive mode) to generate the proposal, specs, and tasks. After it completes, call the `question` tool:

   ```json
   {
     "questions": [
       {
         "header": "Ready to implement",
         "question": "Ready to implement?",
         "options": [
           { "label": "yes", "description": "Load the ob-plan-apply skill to start implementation." },
           { "label": "no", "description": "Stop here. You can run /plan-apply later." }
         ]
       }
     ]
   }
   ```

   Wait for confirmation before loading `ob-plan-apply`.

## Full Azure DevOps CLI Reference

### Work Items
```bash
# Read work item
az boards work-item show --id <id>

# Update work item state
az boards work-item update --id <id> --state "Active"
```

### PR Threads (Comments)
```bash
# Read all threads
az devops invoke \
  --area git --resource pullRequestThreads \
  --route-parameters project={project} repositoryId=<repo> pullRequestId=<id> \
  --http-method GET --api-version 7.1

# Post new comment thread (requires body.json)
az devops invoke \
  --area git --resource pullRequestThreads \
  --route-parameters project={project} repositoryId=<repo> pullRequestId=<id> \
  --http-method POST --api-version 7.1 --in-file body.json

# Reply to existing thread
az devops invoke \
  --area git --resource pullRequestThreadComments \
  --route-parameters project={project} repositoryId=<repo> pullRequestId=<id> threadId=<tid> \
  --http-method POST --api-version 7.1 --in-file reply.json
```

### Comment Body JSON format
```json
{
  "comments": [
    {
      "parentCommentId": 0,
      "content": "Your markdown comment here.",
      "commentType": 1
    }
  ],
  "status": "active"
}
```

For replies, `parentCommentId` should be the ID of the first comment in the thread (usually 1).

## Screenshot / Image Strategy

Save to openspec change folder and reference via raw URL. Use `_apis/git/repositories` URLs (not `_git/`, which return HTML):

```
openspec/changes/{change-name}/images/{screenshot}.png
```

Raw URL format (renders inline in PR comments):
```
https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/items?path=openspec/changes/{change}/images/{file}.png&versionType=branch&version={branch}&api-version=7.1
```

## URL Formats Reference

```
# Sprint board with work item
https://dev.azure.com/{org}/{project}/_sprints/backlog/{team}/{project}/Sprint%20110?workitem=193208

# Direct work item
https://dev.azure.com/{org}/{project}/_workitems/edit/193208

# PR
https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{pr-id}
```

## Output Format

```
## User Story Parsed

Work Item: {id}
Title: {title}
Type: User Story
Iteration: {sprint}
State: {state}

Change Created: us-{id}-{slug}
```
