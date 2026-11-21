---
name: pc-repo-audit
description: Exploratory, read-only audit of every configured repository source root against the fullstack engineer's abilities and guardrails, for a repository with no engineering health data or an on-demand /repo-audit. When an audit selection exists, it follows that instead. Invoked by the /repo-audit command.
license: MIT
---

# Repo Audit

The exploratory audit: for a repository that publishes no engineering health data, or when someone runs `/repo-audit` on demand. A repository whose CI measures its health has the data-led audit, which starts from those numbers; this skill then follows the selection it was given instead of exploring.

Audit the repository without modifying files, installing dependencies, creating backlog items, pushing, or contacting external platforms.

## Step 0: Follow a selection when there is one

If `/tmp/gh-aw/agent/audit-selection.json` exists, read it. When its `source` is anything other than `none`, the work is already chosen from the repository's own measurements: stop here and do not run Steps 1 to 4.

- Read only the files in `selected[].files` (around the lines given) and the paths in `riskMap[].path`. Nothing else.
- Do not re-rank, re-measure, or add measured findings of your own: the values and targets are established.
- Follow the instructions of the workflow that started you for what to write.

When the file does not exist, or its `source` is `none`, continue with Step 1.

## Step 1: Load the audit rules

1. Read `.opencode/agents/fullstack-engineer.md`.
2. Parse every `@skill-name` in its `## Abilities` section.
3. Load every listed skill, guardrails first. If a referenced skill is missing, record it as a finding and continue with the installed abilities.

## Step 2: Establish scope

1. Read `.opencode/source-roots.json` when it exists. Use its non-empty `roots` array; otherwise use the repository root.
2. Inventory every root before judging it. Identify applications, services, libraries, tests, frontend or website projects, infrastructure, CI, package manifests, lockfiles, and generated-output rules.
3. Keep every read and command inside a configured source root or the repository root.

## Step 3: Audit every project

Apply the loaded abilities and guardrails to each discovered project. Look for what a quality gate does not measure:

- Module boundaries and dependencies pointing the wrong way, and duplicated responsibilities.
- Authorization: an endpoint, handler or job that acts without checking who may.
- Data access that costs a query per item (N+1), or loads far more than it uses.
- Tests that assert nothing, or test the mock instead of the behaviour.
- Documentation and configuration drift: `AGENTS.md`, architecture and design documents, scripts and CI that contradict the code.

Do not report what the quality gates already measure when the repository runs them (coverage, duplication, complexity, dependency vulnerabilities, dead or generated files): the gates report those with exact numbers. Mention one only when nothing in the repository measures it, and then only as a missing check, not as a list of findings.

## Step 4: Report

Deduplicate findings across roots and report them grouped by project. Every finding must include:

- Severity: critical, high, medium, or low.
- Affected root, and the exact file, method and line.
- The measured value and its target, when the finding is about something measured.
- Evidence and the applicable guardrail or ability, when one exists, described in your own words.
- Impact and a concrete remediation or verification command.

Never paste a scanner's message or the code a tool matched: refer to it by rule id, file and line. A finding with no file, method and line is not specific enough to report.

When a finding or story you are rewriting ends with a hidden marker line such as `<!-- audit-item: … -->`, keep that line verbatim, as the last line: the next audit finds the item by it.

End with the projects audited, checks that could not run and why, and a short prioritized remediation list. If no findings exist, state that explicitly and list residual verification gaps.
