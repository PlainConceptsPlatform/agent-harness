---
name: ob-repo-audit
description: Audit every configured repository source root against the fullstack engineer's abilities and guardrails. Read-only. Invoked by the /repo-audit command.
license: MIT
---

# Repo Audit

Audit the repository without modifying files, installing dependencies, creating backlog items, pushing, or contacting external platforms.

## Step 1: Load the audit rules

1. Read `.opencode/agents/fullstack-engineer.md`.
2. Parse every `@skill-name` in its `## Abilities` section.
3. Load every listed skill, guardrails first. If a referenced skill is missing, record it as a finding and continue with the installed abilities.

## Step 2: Establish scope

1. Read `.opencode/source-roots.json` when it exists. Use its non-empty `roots` array; otherwise use the repository root.
2. Inventory every root before judging it. Identify applications, services, libraries, tests, frontend or website projects, infrastructure, CI, package manifests, lockfiles, and generated-output rules.
3. Keep every read and command inside a configured source root or the repository root.

## Step 3: Audit every project

Apply the loaded abilities and guardrails to each discovered project. Assess:

- Architecture, module boundaries, naming, and duplicated responsibilities.
- Tests, linting, type checks, builds, CI, and whether their configured commands match the project.
- Dependency manifests, lockfiles, package-manager declarations, runtime versions, and workspace configuration.
- Security and repository hygiene, including generated files, ignored artifacts, and likely secrets in tracked files.
- Documentation and configuration drift across `AGENTS.md`, architecture/design documents, project scripts, and CI.

For dependency findings, identify the exact manifest and lockfile involved. State the repository-native remediation and immutable verification command, such as `pnpm install --frozen-lockfile`, `npm ci`, or `dotnet restore`; never run a mutation-capable install during this audit.

## Step 4: Report

Deduplicate findings across roots and report them grouped by project. Every finding must include:

- Severity: critical, high, medium, or low.
- Affected root and path.
- Evidence and the applicable guardrail or ability, when one exists.
- Impact and a concrete remediation or verification command.

End with the projects audited, checks that could not run and why, and a short prioritized remediation list. If no findings exist, state that explicitly and list residual verification gaps.
