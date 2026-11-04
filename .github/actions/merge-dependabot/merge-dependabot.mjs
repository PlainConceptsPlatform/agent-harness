// Managed by @plainconceptsplatform/workflows@1.13.0. Source: loops/actions/merge-dependabot/merge-dependabot.mjs. Update with workflows update --force; consumer edits may be overwritten.
//
// Squash-merges Dependabot pull requests whose checks are green. API calls only: the pull
// request's code is never checked out or run, and no model decides anything.

import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const DEPENDABOT_LOGINS = new Set(["dependabot[bot]", "app/dependabot"]);
// Dependabot's commits are created through the API: GitHub commits and signs them as web-flow.
const DEPENDABOT_COMMITTERS = new Set(["web-flow", "dependabot[bot]"]);
export const SCOPES = ["all", "minor", "patch", "off"];
export const REBASE_COMMAND = "@dependabot rebase";
const BUMP_RANK = { patch: 1, minor: 2, major: 3, unknown: 4 };
const OK_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);
const MAX_EXAMINED = 30;
const MIN_RATE_REMAINING = 100;
export const NO_CHECKS_GRACE_MINUTES = 60;

export const isDependabot = (login) => DEPENDABOT_LOGINS.has(login ?? "");

export function authorshipProblem(pr, commits, repository) {
  if (!isDependabot(pr.user?.login)) return `opened by ${pr.user?.login ?? "unknown"}`;
  if (String(pr.head?.repo?.full_name).toLowerCase() !== repository.toLowerCase()) return "its branch is in another repository";
  if (!String(pr.head?.ref ?? "").startsWith("dependabot/")) return `branch ${pr.head?.ref} is not a Dependabot branch`;
  if (commits.length === 0) return "it has no commits";
  // The commits endpoint stops at 250, so a longer list cannot be proven all Dependabot's.
  if (commits.length >= 250) return "too many commits to verify";
  for (const commit of commits) {
    const sha = String(commit.sha ?? "").slice(0, 7);
    if (!isDependabot(commit.author?.login)) return `commit ${sha} is by ${commit.author?.login ?? "an unknown author"}`;
    if (!DEPENDABOT_COMMITTERS.has(commit.committer?.login ?? "")) return `commit ${sha} was committed by ${commit.committer?.login ?? "an unknown committer"}`;
    if (commit.commit?.verification?.verified !== true) return `commit ${sha} is not verified`;
  }
  return null;
}

export function labelProblem(pr, skipLabels) {
  const held = (pr.labels ?? []).map((label) => label.name).filter((name) => skipLabels.includes(name));
  return held.length > 0 ? `labelled ${held.join(", ")}` : null;
}

const VERSION = "`?(v?[0-9][^\\s`|]*?)`?";
const TITLE_UPDATE = new RegExp(`\\bbump (\\S+) from ${VERSION} to ${VERSION}(?:\\s+in\\s|\\s*$)`, "i");
const BODY_UPDATE = new RegExp(`^(?:Bumps|Updates|Updated) \\[?\`?([^\\]\`\\s]+)\`?\\]?(?:\\([^)]*\\))? from ${VERSION} to ${VERSION}\\.?\\s*$`, "i");
const TABLE_ROW = new RegExp(`^\\|\\s*\\[?([^\\]|]+?)\\]?(?:\\([^)]*\\))?\\s*\\|\\s*${VERSION}\\s*\\|\\s*${VERSION}\\s*\\|\\s*$`);

export function parseUpdates(title, body) {
  const updates = [];
  const titleMatch = TITLE_UPDATE.exec(title ?? "");
  if (titleMatch) updates.push({ name: titleMatch[1], from: titleMatch[2], to: titleMatch[3] });
  // Release notes and changelogs sit inside <details>, and they quote versions of their own.
  const text = String(body ?? "").replace(/\r\n/g, "\n").replace(/<details>[\s\S]*?<\/details>/gi, "");
  let inTable = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^\|\s*Package\s*\|\s*From\s*\|\s*To\s*\|$/i.test(trimmed)) { inTable = true; continue; }
    if (!trimmed.startsWith("|")) inTable = false;
    const match = BODY_UPDATE.exec(trimmed) ?? (inTable ? TABLE_ROW.exec(trimmed) : null);
    if (match) updates.push({ name: match[1].trim(), from: match[2], to: match[3] });
  }
  const seen = new Set();
  return updates.filter((update) => {
    const key = `${update.name}\0${update.from}\0${update.to}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

const numeric = (version) => {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
};

export function bumpLevel(from, to) {
  const before = numeric(from);
  const after = numeric(to);
  if (before === null || after === null) return "unknown";
  if (before[0] !== after[0]) return "major";
  if (before[1] !== after[1]) return "minor";
  return "patch";
}

export function highestBump(updates) {
  if (updates.length === 0) return "unknown";
  return updates.map((update) => bumpLevel(update.from, update.to))
    .reduce((highest, level) => (BUMP_RANK[level] > BUMP_RANK[highest] ? level : highest), "patch");
}

export function scopeAllows(scope, bump) {
  if (scope === "all") return true;
  if (scope === "minor") return bump === "patch" || bump === "minor";
  if (scope === "patch") return bump === "patch";
  return false;
}

export function summarizeChecks({ checkRuns = [], statuses = [], required = [] }) {
  const latest = new Map();
  for (const run of checkRuns) {
    const known = latest.get(run.name);
    if (known === undefined || run.id > known.id) latest.set(run.name, run);
  }
  const failing = [];
  const pending = [];
  for (const run of latest.values()) {
    if (run.status !== "completed") pending.push(run.name);
    else if (!OK_CONCLUSIONS.has(run.conclusion)) failing.push(`${run.name} (${run.conclusion})`);
  }
  for (const status of statuses) {
    if (status.state === "pending") pending.push(status.context);
    else if (status.state !== "success") failing.push(`${status.context} (${status.state})`);
  }
  const reported = new Set([...latest.keys(), ...statuses.map((status) => status.context)]);
  for (const context of required) {
    if (!reported.has(context)) pending.push(`${context} (required, not reported)`);
  }
  const state = failing.length > 0 ? "failure" : pending.length > 0 ? "pending" : reported.size === 0 ? "none" : "success";
  return { state, failing, pending };
}

export function rebaseAlreadyRequested(comments, headCommittedAt) {
  const since = Date.parse(headCommittedAt ?? "");
  return comments.some((comment) =>
    String(comment.body ?? "").trim().toLowerCase() === REBASE_COMMAND &&
    (Number.isNaN(since) || Date.parse(comment.created_at) >= since));
}

// One pull request, everything already fetched. The decision is pure so it can be tested.
export function decide({ pr, commits, defaultBranch, repository, skipLabels, scope, checks, comments, mergeWithoutChecks, now }) {
  const bump = highestBump(parseUpdates(pr.title, pr.body));
  const skip = (reason) => ({ action: "skip", reason, bump });
  if (pr.draft) return skip("draft");
  if (pr.base?.ref !== defaultBranch) return skip(`targets ${pr.base?.ref}, not ${defaultBranch}`);
  const labelled = labelProblem(pr, skipLabels);
  if (labelled) return skip(labelled);
  const authorship = authorshipProblem(pr, commits, repository);
  if (authorship) return skip(authorship);
  if (!scopeAllows(scope, bump)) return skip(`${bump} update, DEPENDABOT_MERGE is ${scope}`);

  const headCommittedAt = commits.at(-1)?.commit?.committer?.date;
  if (pr.mergeable === false || pr.mergeable_state === "dirty" || pr.mergeable_state === "behind") {
    const why = pr.mergeable_state === "behind" ? "behind its base" : "conflicting";
    if (rebaseAlreadyRequested(comments, headCommittedAt)) return { action: "wait", reason: `${why}; rebase already requested`, bump };
    return { action: "rebase", reason: why, bump };
  }
  if (pr.mergeable !== true) return { action: "wait", reason: "GitHub has not computed mergeability yet", bump };

  if (checks.state === "failure") return { action: "fail", reason: `failing: ${checks.failing.join(", ")}`, bump };
  if (checks.state === "pending") return { action: "wait", reason: `pending: ${checks.pending.join(", ")}`, bump };
  if (checks.state === "none") {
    if (!mergeWithoutChecks) return skip("no checks, DEPENDABOT_MERGE_WITHOUT_CHECKS is false");
    // CI that has not registered yet looks like no CI at all.
    const ageMinutes = (now - Date.parse(headCommittedAt ?? pr.updated_at)) / 60000;
    if (!(ageMinutes >= NO_CHECKS_GRACE_MINUTES)) return { action: "wait", reason: `no checks yet; merging once the head is ${NO_CHECKS_GRACE_MINUTES} minutes old`, bump };
    return { action: "merge", reason: "no checks configured", bump };
  }
  return { action: "merge", reason: "checks green", bump };
}

export function readConfig(env) {
  const scope = String(env.SCOPE || "all").trim().toLowerCase();
  if (!SCOPES.includes(scope)) throw new Error(`DEPENDABOT_MERGE must be one of ${SCOPES.join(", ")}, not "${env.SCOPE}"`);
  const maxMerges = Number(env.MAX_MERGES || "5");
  if (!Number.isInteger(maxMerges) || maxMerges < 0) throw new Error(`max-merges must be a whole number, not "${env.MAX_MERGES}"`);
  return {
    scope,
    maxMerges,
    mergeWithoutChecks: String(env.MERGE_WITHOUT_CHECKS || "true").trim().toLowerCase() !== "false",
    skipLabels: String(env.SKIP_LABELS ?? "").split(/[\s,]+/).filter(Boolean),
    dryRun: String(env.DRY_RUN || "false").trim().toLowerCase() === "true",
    postMergeEvent: String(env.POST_MERGE_EVENT ?? "").trim(),
  };
}

export function createClient({ token, apiUrl = "https://api.github.com", fetchImpl = fetch }) {
  const state = { remaining: Infinity };
  const request = async (method, path, body) => {
    const response = await fetchImpl(path.startsWith("http") ? path : `${apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const remaining = Number(response.headers.get("x-ratelimit-remaining"));
    if (!Number.isNaN(remaining)) state.remaining = remaining;
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: response.status, data, link: response.headers.get("link") ?? "" };
  };
  const paginate = async (path, limit = 300) => {
    const items = [];
    let next = path;
    while (next && items.length < limit) {
      const page = await request("GET", next);
      if (page.status >= 400) throw new Error(`GET ${next} answered ${page.status}: ${JSON.stringify(page.data)}`);
      items.push(...(Array.isArray(page.data) ? page.data : page.data?.check_runs ?? []));
      next = /<([^>]+)>;\s*rel="next"/.exec(page.link)?.[1];
    }
    return items;
  };
  return { request, paginate, rateRemaining: () => state.remaining };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readPullRequest(client, repository, number, wait) {
  for (let attempt = 0; ; attempt++) {
    const { data } = await client.request("GET", `/repos/${repository}/pulls/${number}`);
    if (data?.mergeable !== null || attempt >= 3) return data;
    await wait(2000);
  }
}

async function requiredChecks(client, repository, branch) {
  const contexts = new Set();
  const rules = await client.request("GET", `/repos/${repository}/rules/branches/${encodeURIComponent(branch)}`);
  for (const rule of Array.isArray(rules.data) ? rules.data : []) {
    if (rule.type !== "required_status_checks") continue;
    for (const check of rule.parameters?.required_status_checks ?? []) contexts.add(check.context);
  }
  const protection = await client.request("GET", `/repos/${repository}/branches/${encodeURIComponent(branch)}`);
  for (const context of protection.data?.protection?.required_status_checks?.contexts ?? []) contexts.add(context);
  return [...contexts];
}

async function readChecks(client, repository, sha, required) {
  const checkRuns = await client.paginate(`/repos/${repository}/commits/${sha}/check-runs?per_page=100`);
  const combined = await client.request("GET", `/repos/${repository}/commits/${sha}/status?per_page=100`);
  return summarizeChecks({ checkRuns, statuses: combined.data?.statuses ?? [], required });
}

async function land(client, repository, pr, config) {
  if (pr.mergeable_state === "blocked") {
    // A ruleset may require an approval; one from this token meets it.
    await client.request("POST", `/repos/${repository}/pulls/${pr.number}/reviews`, {
      commit_id: pr.head.sha, event: "APPROVE", body: "Dependabot update with every check green.",
    });
  }
  const merged = await client.request("PUT", `/repos/${repository}/pulls/${pr.number}/merge`, {
    merge_method: "squash", sha: pr.head.sha,
  });
  if (merged.status === 200) {
    await client.request("DELETE", `/repos/${repository}/git/refs/heads/${pr.head.ref}`);
    if (config.postMergeEvent) {
      // The same payload land-pull-request sends, so a consumer deploying on it needs nothing new.
      await client.request("POST", `/repos/${repository}/dispatches`, {
        event_type: config.postMergeEvent, client_payload: { sha: pr.head.sha, pr: String(pr.number), base: pr.base.ref },
      });
    }
    return { action: "merged", reason: `squash-merged as ${String(merged.data?.sha ?? "").slice(0, 7)}` };
  }
  const message = String(merged.data?.message ?? JSON.stringify(merged.data)).slice(0, 200);
  if (merged.status === 405 && /merge queue/i.test(message)) {
    const enqueued = await client.request("POST", "/graphql", {
      query: "mutation($id:ID!,$sha:GitObjectID!){enqueuePullRequest(input:{pullRequestId:$id,expectedHeadOid:$sha}){mergeQueueEntry{state}}}",
      variables: { id: pr.node_id, sha: pr.head.sha },
    });
    if (enqueued.data?.data?.enqueuePullRequest?.mergeQueueEntry) return { action: "enqueued", reason: "added to the merge queue" };
    return { action: "blocked", reason: `the merge queue refused it: ${JSON.stringify(enqueued.data?.errors ?? enqueued.data).slice(0, 200)}` };
  }
  if (merged.status === 409) return { action: "wait", reason: "the head moved while it was judged; next run" };
  if ([403, 405, 422].includes(merged.status)) return { action: "blocked", reason: `GitHub refused the merge: ${message}` };
  return { action: "error", reason: `merge answered ${merged.status}: ${message}` };
}

export async function run({ client, repository, config, now = Date.now(), log = console.log, wait = sleep }) {
  const rows = [];
  if (config.scope === "off") return { rows, off: true };

  const { data: repo } = await client.request("GET", `/repos/${repository}`);
  const defaultBranch = repo.default_branch;
  const open = await client.paginate(`/repos/${repository}/pulls?state=open&sort=created&direction=asc&per_page=100`);
  const candidates = open.filter((pr) => isDependabot(pr.user?.login)).slice(0, MAX_EXAMINED);
  const required = candidates.length > 0 ? await requiredChecks(client, repository, defaultBranch) : [];
  let merges = 0;

  for (const listed of candidates) {
    if (client.rateRemaining() < MIN_RATE_REMAINING) {
      rows.push({ number: listed.number, title: listed.title, bump: "", action: "wait", reason: "API rate limit nearly spent" });
      continue;
    }
    const pr = await readPullRequest(client, repository, listed.number, wait);
    const commits = await client.paginate(`/repos/${repository}/pulls/${pr.number}/commits?per_page=100`, 250);
    const comments = await client.paginate(`/repos/${repository}/issues/${pr.number}/comments?per_page=100`);
    const mergeableNow = pr.mergeable === true && !["dirty", "behind"].includes(pr.mergeable_state);
    const checks = mergeableNow ? await readChecks(client, repository, pr.head.sha, required) : { state: "none", failing: [], pending: [] };
    let outcome = decide({
      pr, commits, defaultBranch, repository, comments, checks, now,
      skipLabels: config.skipLabels, scope: config.scope, mergeWithoutChecks: config.mergeWithoutChecks,
    });

    if (outcome.action === "merge" && merges >= config.maxMerges) {
      outcome = { ...outcome, action: "wait", reason: `${config.maxMerges} merged this run; next run` };
    } else if (outcome.action === "merge") {
      merges++;
      outcome = config.dryRun ? { ...outcome, action: "would merge" } : { ...outcome, ...await land(client, repository, pr, config) };
    } else if (outcome.action === "rebase") {
      if (!config.dryRun) await client.request("POST", `/repos/${repository}/issues/${pr.number}/comments`, { body: REBASE_COMMAND });
      outcome = { ...outcome, action: config.dryRun ? "would ask rebase" : "asked rebase" };
    }
    log(`#${pr.number} ${outcome.action}: ${outcome.reason}`);
    rows.push({ number: pr.number, title: pr.title, bump: outcome.bump, action: outcome.action, reason: outcome.reason });
  }
  return { rows, off: false };
}

export function renderSummary({ rows, off }, config) {
  const lines = [`## Dependabot merge (${config.dryRun ? "dry run, " : ""}scope: ${config.scope})`, ""];
  if (off) return [...lines, "DEPENDABOT_MERGE is off: nothing was examined.", ""].join("\n");
  if (rows.length === 0) return [...lines, "No open Dependabot pull requests.", ""].join("\n");
  lines.push("| PR | Update | Bump | Result | Why |", "|---|---|---|---|---|");
  const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  for (const row of rows) lines.push(`| #${row.number} | ${cell(row.title)} | ${cell(row.bump)} | ${cell(row.action)} | ${cell(row.reason)} |`);
  return [...lines, ""].join("\n");
}

async function main() {
  const config = readConfig({
    SCOPE: process.env.SCOPE, MAX_MERGES: process.env.MAX_MERGES, MERGE_WITHOUT_CHECKS: process.env.MERGE_WITHOUT_CHECKS,
    SKIP_LABELS: process.env.SKIP_LABELS, DRY_RUN: process.env.DRY_RUN, POST_MERGE_EVENT: process.env.POST_MERGE_EVENT,
  });
  const client = createClient({ token: process.env.GH_TOKEN, apiUrl: process.env.GITHUB_API_URL || "https://api.github.com" });
  const result = await run({ client, repository: process.env.REPO, config });
  const summary = renderSummary(result, config);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  else console.log(summary);
  const stuck = result.rows.filter((row) => row.action === "fail" || row.action === "blocked").length;
  if (stuck > 0) console.log(`::notice::${stuck} Dependabot pull request(s) left open with failing checks or a refused merge; see the job summary.`);
  const errors = result.rows.filter((row) => row.action === "error");
  for (const row of errors) console.log(`::error::#${row.number}: ${row.reason}`);
  if (errors.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.log(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
