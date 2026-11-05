import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "harness-doctor.mjs");
let root;

function fixture(manifest) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-doctor-"));
  const opencode = path.join(root, ".opencode");
  fs.mkdirSync(path.join(opencode, "agents"), { recursive: true });
  fs.writeFileSync(path.join(opencode, "harness-models.json"), JSON.stringify(manifest, null, 2));
  return opencode;
}

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe("harness doctor", () => {
  it("prints the effective routing and the planner alias", () => {
    fixture({
      models: {
        plan: "plainconcepts/glm-5-3",
        build: "plainconcepts/glm-5-2",
        fast: "plainconcepts/glm-5-2",
      },
      source: { plan: "team", build: "team", fast: "team" },
      agents: {
        "planner-sub": { file: "planner-sub.md", mode: "subagent", model: "plainconcepts/glm-5-3" },
      },
      warnings: [],
    });
    fs.writeFileSync(path.join(root, ".opencode", "agents", "planner-sub.md"), "---\nmode: subagent\n---\n");

    const output = execFileSync(process.execPath, [SCRIPT, "--root", root, "--strict"], { encoding: "utf8" });
    expect(output).toContain("Model routing");
    expect(output).toContain("plainconcepts/glm-5-3");
    expect(output).toContain("planner-sub.md");
  });

  it("fails strict when the planner alias is missing", () => {
    fixture({
      models: { plan: "p/plan", build: "p/build", fast: "p/fast" },
      source: { plan: "team", build: "team", fast: "team" },
      agents: {},
      warnings: [],
    });

    const result = spawnSync(process.execPath, [SCRIPT, "--root", root, "--strict"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("planner file: missing");
  });
});
