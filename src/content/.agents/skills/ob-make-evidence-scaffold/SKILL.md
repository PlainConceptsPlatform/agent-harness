---
name: ob-make-evidence-scaffold
description: DEPRECATED. Visual evidence is now built into ob-ops-evidence using playwright-cli + pnpm run dev. No per-project scaffold is needed. This skill is kept for backward compatibility but should not be used.
license: MIT
---

# DEPRECATED

This skill is no longer needed. Visual evidence is now handled directly by `ob-ops-evidence` using:

1. `playwright-cli` (headless browser automation, works inside containers)
2. `pnpm run dev` (convention: starts the full app stack with mock auth)

No per-project scaffold, fixture apps, or scenario registries are required. The `ob-ops-evidence` skill handles everything generically.

If you previously ran `/make-evidence-scaffold` and have a `src/visual-evidence/` directory or `visual-evidence` scripts in `package.json`, you can delete them — the new system does not use them.

To capture evidence for a change, just run `/ops-evidence` or let `/plan-goal` handle it automatically.
