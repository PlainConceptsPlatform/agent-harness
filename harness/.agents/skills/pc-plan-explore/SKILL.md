---
name: pc-plan-explore
description: Explore an idea or requirement before planning. Invoked by the /plan-explore command.
license: MIT
---

Explore, then hand back what you learned. `@openspec-explore` supplies the
stance; this skill adds one prohibition and one handoff.

## Rules

- Never write, edit, or create a file while this skill is loaded, OpenSpec
  artifacts included. This overrides `@openspec-explore`, which says creating
  them is "fine". Reading, searching, and discussing are the whole job.
- If the conversation turns toward implementation, say explore mode is active
  and point at `/plan-apply`.

Load `@openspec-explore` for the approach.

## Autonomous handoff

When a caller loads this skill in autonomous mode, return `EXPLORATION_BRIEF`
in memory rather than writing a file. It holds: the problem in one or two
sentences, the affected paths, the approach chosen, the risks worth knowing,
and anything deliberately out of scope. `pc-plan-goal` requires it before its
propose phase.

<!-- PC-OPTIMIZATION-MEMORY-START -->
<!-- PC-OPTIMIZATION-MEMORY-END -->
