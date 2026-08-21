**NEVER use browser tools to navigate to atlassian.net: use `acli` CLI only.**

---

### Step 1: Parse input

`$ARGUMENTS` is the issue title/description. If it contains a title and body separated by a newline or `---`, split them. Otherwise use the full text as the title with an empty body.

### Step 2: Create issue

```bash
acli jira issue create \
  --summary "{title}" \
  --description "{body}" \
  --type "Story"
```

### Step 3: Report

```text
Issue created
  Key: {key}
  Title: {title}
  URL: {issue-url}
```

Tell the user: "Use `/plan-propose {issue-url}` to turn this into a plan."

---