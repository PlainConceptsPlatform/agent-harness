Azure DevOps data comes from the `az` CLI; a page fetch of dev.azure.com is denied (pc-system-reminders). If `az` is unavailable, report it as a blocker. Browser tools reach only the local app on `localhost`.

---

### Step 1: Verify feature branch

```bash
git branch --show-current
```

Branch must be `feature/{id}-{slug}`. NEVER push to `main`.

### Step 2: Capture screenshots (if UI changes exist)

```bash
browser_navigate url="http://localhost:{port}/{route}"
browser_wait ms=2000
browser_screenshot
```

Save to: `openspec/changes/{change-name}/images/{feature}.png`

### Step 3: Commit and push

The `pc-plan-apply` skill already committed each task group: usually only screenshots or small residuals remain. Stage the paths you actually changed; unscoped staging is denied (`pc-system-reminders`):

```bash
git add openspec/changes/{change-name}/images/  # plus any other paths you actually changed
git commit -m "feat({scope}): {description} (#{id})"
git push origin feature/{id}-{slug}
```

### Step 4: Create PR

```bash
az repos pr create \
  --repository {repo} \
  --source-branch feature/{id}-{slug} \
  --target-branch main \
  --title "feat({scope}): {title} (#{id})" \
  --description "{description}"
```

### Step 5: Link work item (MANDATORY, run sequentially, not in parallel)

```bash
az repos pr work-item add --id {pr-id} --work-items {workitem-id}
```

### Step 6: Post screenshot comment

Build raw URL for each image:

```
https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/items?path=openspec/changes/{change}/images/{file}.png&versionType=branch&version={branch}&api-version=7.1
```

Post via:

```bash
az devops invoke \
  --area git --resource pullRequestThreads \
  --route-parameters project={project} repositoryId={repo} pullRequestId={pr-id} \
  --http-method POST --api-version 7.1 --in-file body.json
```

`body.json`:

```json
{
  "comments": [
    {
      "parentCommentId": 0,
      "content": "## Screenshots\n\n![{feature}]({raw-url})",
      "commentType": 1
    }
  ],
  "status": "active"
}
```

---