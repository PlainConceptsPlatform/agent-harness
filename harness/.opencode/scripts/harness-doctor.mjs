#!/usr/bin/env node
// Print the effective model routing and the generated agents. --strict exits 1
// on any warning, a missing planner-sub, or a manifest older than its configs.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = rootIndex !== -1 ? path.resolve(args[rootIndex + 1]) : process.cwd();
const strict = args.includes("--strict");
const manifestPath = path.join(root, ".opencode", "harness-models.json");

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

if (!fs.existsSync(manifestPath)) {
  fail(`harness-doctor: ${manifestPath} is missing; run node .opencode/scripts/sync-agents.mjs`, 2);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail(`harness-doctor: ${manifestPath} is not valid JSON: ${error.message}`, 2);
}

const models = manifest.models ?? {};
const sources = manifest.source ?? {};
const warnings = Array.isArray(manifest.warnings) ? manifest.warnings : [];
const agents = manifest.agents ?? {};
const planner = agents["planner-sub"] ?? agents.planner;
const plannerFile = planner?.file ? path.join(root, ".opencode", "agents", planner.file) : null;
const plannerExists = plannerFile ? fs.existsSync(plannerFile) : false;

console.log("Model routing");
console.log(`  ${"tier".padEnd(6)} ${"effective".padEnd(40)} source`);
for (const tier of ["plan", "build", "fast"]) {
  console.log(`  ${tier.padEnd(6)} ${String(models[tier] ?? "(session)").padEnd(40)} ${sources[tier] ?? "missing"}`);
}
console.log(`  ${"lead".padEnd(6)} ${"session model (ci-workflow-agent)".padEnd(40)} session`);
console.log(`  ${"planner".padEnd(6)} ${String(planner?.model ?? "(session)").padEnd(40)} ${planner?.mode ?? "missing"}`);
console.log(`  planner file: ${plannerFile ? `${planner.file}${plannerExists ? "" : " (missing)"}` : "missing"}`);
console.log(`  agents: ${Object.keys(agents).length} entries, ${warnings.length} warning(s)`);

for (const warning of warnings) console.error(`warning: ${warning}`);

if (strict && (!planner || !plannerExists || warnings.length > 0)) {
  process.exit(1);
}
