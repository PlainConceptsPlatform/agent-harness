---
name: ob-ops-evidence
description: Capture visual evidence using playwright-cli + pnpm run dev convention. Writes evidence/evidence.json with passed/skipped/failed/blocked status and publishes to PR. Load after a change is implemented. Invoked by /ops-evidence and the plan-goal pipeline.
license: MIT
---

# Ops Evidence

Capture screenshots of the running app to prove a change works visually. Store them in the OpenSpec change folder and publish a status comment to the PR.

Capture is best-effort and must never be fatal. But be honest: a change that needed evidence and couldn't produce it is `blocked`, not `skipped`.

## Convention

Every platform project has `pnpm run dev` at root that starts the **full stack** (database + API + web). The app runs with mock auth in development mode (no real authentication needed). This is the only contract — no per-project evidence harness, fixture apps, or scenario registries.

Screenshots are captured with `playwright-cli` (headless by default, works inside containers).

## Input

The caller provides (all optional):
- change id: locates `openspec/changes/{change-id}/` (or the archived `archive/*{change-id}/`).
- issue / work-item ref and PR number: where to publish.
- output mode (`default` / `push` / `pr`): whether the branch was pushed.
- operation: `capture` (default), `publish`, or `both`.

## Part 1: Capture (operation: capture / both)

**Step 1: Decide whether evidence is required.** Inspect the change's diff:
- Required when changed files include user-visible UI: `*.tsx/jsx/vue/svelte`, `*.css/scss/less`, pages, layouts, components, navigation.
- Skipped when docs-only, internal refactor, dependency-only, test-only, backend-only.
- Mixed or unknown: required (be safe).

If skipped: write `evidence.json` with `status: "skipped"` and reason. Done.

**Step 2: Discover routes from git diff.** Parse changed files to determine which routes to screenshot:
- `pages/**/*.tsx` or `app/**/page.tsx` → extract the route path
- `features/**/*.tsx` or `components/**/*.tsx` → screenshot the homepage and any routes that import the changed component
- If no routes found → screenshot `/` only
- Always include `/` (homepage) as a baseline

**Step 3: Start the app stack. YOU MUST ALWAYS TRY THIS. Never skip by assuming the environment can't run the app. The database may already be running on the host. `pnpm run dev` knows how to detect and skip database startup if it's already running. Execute it and see what happens.**

```bash
# Start the full stack in background
# The project's pnpm run dev starts everything: database (if not already running), API, web server.
# Inside CI containers, the database may have been pre-started by the CI setup steps.
# pnpm run dev will detect this and only start the app servers.
nohup pnpm run dev > /tmp/gh-aw/app-dev.log 2>&1 &

# Poll for the dev server. Check common ports sequentially.
# IMPORTANT: The first port to respond might be a proxy or a 404 page.
# Verify the response is HTTP 200 (not 404) before using it.
APP_URL=""
for port in 3000 3001 5173 5174 5175 5180; do
  for i in $(seq 1 90); do  # 3 minutes total per port
    HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:${port}" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
      APP_URL="http://127.0.0.1:${port}"
      echo "App is ready at $APP_URL (HTTP $HTTP_CODE)"
      break 2
    fi
    # Port is responding but not 200 yet - server might still be compiling
    sleep 2
  done
done

if [ -z "$APP_URL" ]; then
  echo "App did not return HTTP 200 within the polling window"
  # Check the log for errors before writing blocked
  tail -50 /tmp/gh-aw/app-dev.log
  # Fall through to write blocked evidence.json
fi
```

**Step 4: Capture screenshots with playwright-cli.**
```bash
# Determine evidence directory
REPO_ROOT="$(git rev-parse --show-toplevel)"
DEST="$(ls -d "$REPO_ROOT/openspec/changes/archive/"*"{change-id}" 2>/dev/null | head -1)"
[ -z "$DEST" ] && DEST="$REPO_ROOT/openspec/changes/{change-id}"
mkdir -p "$DEST/evidence"

# Open the app (headless by default, works in containers)
playwright-cli open "$APP_URL"

# Wait for the page to fully render (JS frameworks need time to hydrate)
sleep 3

# Take a snapshot to see what's on the page
playwright-cli snapshot

# If a login page with mock users is shown, click the first mock user button
# (look for buttons with email-like text or "mock" in the snapshot refs)
# playwright-cli click {ref}

# Desktop screenshot (default viewport 1280x720)
playwright-cli screenshot --filename="$DEST/evidence/01-desktop-home.png"

# Screenshot changed routes
for route in $ROUTES; do
  playwright-cli goto "$APP_URL$route"
  sleep 1
  playwright-cli screenshot --filename="$DEST/evidence/02-route.png"
done

# Mobile viewport screenshot
playwright-cli close
playwright-cli open "$APP_URL" --viewport=375,667
playwright-cli screenshot --filename="$DEST/evidence/03-mobile-home.png"

# Clean up
playwright-cli close
```

Time budget: 2 minutes total for capture. If the app doesn't start or a route 404s, write `evidence.json` with `status: "blocked"` and continue.

**Step 5: Always write `evidence.json`.** Even blocked/skipped changes get a manifest:
```json
{
  "version": 1,
  "changeId": "{change-id}",
  "required": true,
  "status": "passed",
  "assets": [
    { "type": "screenshot", "path": "openspec/changes/archive/.../evidence/01-desktop-home.png", "caption": "Desktop homepage", "bytes": 12345, "format": "png" }
  ],
  "reason": "",
  "prMarkdown": "## Evidence\n\n![Desktop](path)\n\n![Mobile](path)"
}
```

**Step 6: Kill the dev server.**
```bash
# Kill the background dev process
kill %1 2>/dev/null || true
pkill -f "pnpm.*dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "dotnet watch" 2>/dev/null || true
```

Capture never commits, stages, or pushes. The caller owns git.

## Part 2: Publish (operation: publish / both)

Preconditions:
- An issue/PR number was provided. Else skip.
- Image URLs resolve only if the branch was pushed (`pr`/`push` modes).
- Backlog platform from `.opencode/opencode-onboard.json`; `none` means skip.

<!-- OB-PLATFORM-EVIDENCE-START -->
<!-- OB-PLATFORM-EVIDENCE-END -->

## Report

One block: the `status` (passed/skipped/failed/blocked) and why; assets written or why not; whether a comment was posted. Never present a blocked capture as passed.
