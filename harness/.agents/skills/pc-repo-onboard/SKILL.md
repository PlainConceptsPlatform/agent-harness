---
name: pc-repo-onboard
description: Walk the user through the project and its agentic infrastructure. Explains what exists, how agents work, and how to use the system. Invoked by the /repo-onboard command.
license: MIT
---

A guided tour of this repository and the harness installed in it, for somebody who has just arrived. Read and explain; change nothing.

## Rules

- Never write, edit, or create a file, and never run a command from the tour to demonstrate it. The output is the explanation.
- Never describe an agent, command, skill or setting that is not in this repository. The tour is worth having because it is specific: read `.opencode/agents/`, `.opencode/commands/`, `.agents/skills/`, `.opencode/harness.json`, `AGENTS.md`, `ARCHITECTURE.md` and `DESIGN.md` and report what is actually there.

## Cover, in this order

1. **The project.** Three to five bullets: what it is, the stack, the directories that matter.
2. **The agents.** One table row per file in `.opencode/agents/`, with its tier and purpose. Then the selection model: `build` and `plan` are the only two a human picks and both run the `fullstack-engineer` body, `plan` can neither edit nor spawn, everything else is `mode: subagent` and reached through `task()`, and a missing specialist is made with `/make-engineer`.
3. **The commands**, grouped by what they are for:

   | Group | Commands |
   |---|---|
   | Planning | `/plan-explore`, `/plan-story`, `/plan-propose`, `/plan-quick`, `/plan-goal` |
   | Implementation | `/plan-apply`, `/plan-archive` |
   | Maintenance | `/make-architecture`, `/make-design`, `/make-engineer`, `/make-guardrails` |
   | Shipping | `/ops-ship`, `/ops-review`, `/ops-backlog`, `/ops-evidence` |
   | Quality | `/repo-audit` (read-only), `/repo-verify` (the branch gate) |
   | Setup | `/init`, `/make-user-model`, `/repo-help` |

4. **The skills** installed in `.agents/skills/`, one line each, marking which are platform-specific.
5. **The OpenSpec lifecycle**: explore, propose, apply, archive, and what `openspec/config.yaml` controls.
6. **The configuration** in `.opencode/harness.json`: what each section governs, that `/make-user-model` changes a tier's model, and what `agents.maxConcurrent` caps.
7. **Where to start.** `/plan-goal` with a description of the work, `/repo-help` for everything else, and `npx @plainconceptsplatform/agent-harness` to refresh the harness after changing config.
