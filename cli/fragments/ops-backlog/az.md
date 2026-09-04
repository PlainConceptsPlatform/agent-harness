**Browser MCP tools are FORBIDDEN for all Azure DevOps operations.**

---

### Step 1: Parse input

`$ARGUMENTS` is the work item title/description. If it contains a title and body separated by a newline or `---`, split them. Otherwise use the full text as the title with an empty body.

### Step 2: Create work item

```bash
az boards work-item create \
  --title "{title}" \
  --description "{body}" \
  --type "User Story"
```

### Step 3: Report

```text
Work item created
  ID: {id}
  Title: {title}
  URL: {work-item-url}
```

Tell the user: "Use `/plan-propose {work-item-url}` to turn this into a plan."

---