#!/usr/bin/env node
// Generate the build/plan/planner/planner-sub agents and the tier variants
// before OpenCode starts. CI runs this in a pre-agent step so the task tool's
// enum includes them from the first turn. Local users can run it too.

import path from "node:path";
import { generateAgents } from "../plugins/pc-subagent-tiers-core.js";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = rootIndex !== -1 ? path.resolve(args[rootIndex + 1]) : process.cwd();
const strict = args.includes("--strict");

try {
  const result = await generateAgents({ root });
  console.log(`Model routing (${path.join(root, ".opencode", "harness-models.json")})`);
  for (const tier of ["plan", "build", "fast"]) {
    console.log(`  ${tier.padEnd(6)} ${String(result.models[tier] ?? "(session)").padEnd(40)} ${result.sources[tier]}`);
  }
  console.log(
    `  agents ${result.templates.length} engineer template(s), ${result.variants.length} variant(s), ` +
      `${result.hasFullstack ? "planner + planner-sub" : "planner missing (no fullstack)"}`,
  );
  for (const warning of result.warnings) console.error(`warning: ${warning}`);
  if (strict && result.warnings.length > 0) process.exit(1);
} catch (error) {
  console.error(`sync-agents: ${error?.message ?? error}`);
  process.exit(1);
}
