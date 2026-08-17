---
name: ob-make-evidence-scaffold
description: DEPRECATED. Visual evidence is now built into ob-ops-evidence using playwright-cli + pnpm run dev. No per-project scaffold is needed. This skill is kept for backward compatibility but should not be used.
license: MIT
---

# DEPRECATED

This skill is no longer needed. Visual evidence uses a two-phase architecture:

1. **Agent phase:** `ob-ops-evidence` writes a `capturePlan` in `evidence.json` (the agent sandbox cannot run Docker or headless Chromium)
2. **CI phase:** A separate "Visual evidence" CI workflow reads the capturePlan and captures screenshots on a runner with full Docker and Chrome access

No per-project scaffold, fixture apps, or scenario registries are required. The `ob-ops-evidence` skill handles everything generically.

If you previously ran `/make-evidence-scaffold` and have a `src/visual-evidence/` directory or `visual-evidence` scripts in `package.json`, you can delete them — the new system does not use them.

To capture evidence for a change, just run `/ops-evidence` or let `/plan-goal` handle it automatically.
