**Browser MCP tools are FORBIDDEN for all Azure DevOps operations.**

---

### Step 1: Find PRs

If PR link provided, extract ID from URL. Otherwise:

```bash
az repos pr list --repository {repo} --status active --top 1
```

### Step 2: Read comment threads

```bash
az devops invoke \
  --area git --resource pullRequestThreads \
  --route-parameters project={project} repositoryId={repo} pullRequestId={id} \
  --http-method GET --api-version 7.1
```

### Step 3: Categorize feedback

| Category      | Description                         | Action                              |
| ------------- | ----------------------------------- | ----------------------------------- |
| `code-change` | Reviewer requests code modification | Return to lead to spawn specialists |
| `spec-update` | Affects proposal, design, or tasks  | Update openspec artifacts           |
| `question`    | Reviewer asks a question            | Reply with answer                   |
| `resolved`    | Thread already resolved             | Skip                                |

### Step 4: Update openspec (if spec-update)

```bash
git branch --show-current
# feature/193208-roles-crud → change: us-193208-roles-crud
```

Update: `openspec/changes/{change}/proposal.md`, `design.md`, or `tasks.md` as appropriate.

### Step 5: Reply to each thread

```bash
az devops invoke \
  --area git --resource pullRequestThreadComments \
  --route-parameters project={project} repositoryId={repo} pullRequestId={id} threadId={tid} \
  --http-method POST --api-version 7.1 --in-file reply.json
```

`reply.json`:

```json
{
  "comments": [
    {
      "parentCommentId": 1,
      "content": "Acknowledged, applying this change now.",
      "commentType": 1
    }
  ]
}
```

---