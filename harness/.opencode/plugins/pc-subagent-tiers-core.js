// pc-subagent-tiers-core: pure Node agent generation. The plugin and the
// standalone sync script both call this, so a CI pre-start step can write the
// agents before OpenCode builds its task enum. No @opencode/plugin import here.
//
// Agent topology:
//   build.md / plan.md      mode: primary   the only agents a human selects.
//   planner.md              mode: all       fullstack body on the plan tier;
//                                            commands run on it, it cannot spawn.
//   planner-sub.md          mode: subagent  spawnable plan-tier alias for the
//                                            task tool, same body, cannot spawn.
//   fullstack-engineer.md   mode: subagent  shared body and fallback worker.
//   *-engineer.md           mode: subagent  specialists.
//   *-engineer.<tier>.md    mode: subagent  the same specialist pinned to a tier.

import fs from "node:fs/promises";
import path from "node:path";

export const TIERS = ["build", "fast", "plan"];
export const MANIFEST_FILE = "harness-models.json";
export const FULLSTACK_NAME = "fullstack-engineer";
export const FULLSTACK_TEMPLATE = `${FULLSTACK_NAME}.md`;

export const PRIMARIES = {
  build: {
    tier: "build",
    color: "primary",
    description:
      "Implement changes in this repository. Full write access, spawns specialist engineers for parallel work.",
    permissions: null,
  },
  plan: {
    tier: "plan",
    color: "warning",
    description:
      "Explore and plan without touching the tree. Read-only: proposes work for build to carry out.",
    permissions: [
      { action: "edit", resource: "*", effect: "deny" },
      { action: "subagent", resource: "*", effect: "deny" },
    ],
  },
  planner: {
    tier: "plan",
    mode: "all",
    color: "info",
    description:
      "Write plans, proposals, stories, reviews and archives on the plan model. Edits the tree, never spawns workers.",
    permissions: [{ action: "subagent", resource: "*", effect: "deny" }],
  },
};

const THEME_COLORS = new Set(["primary", "secondary", "accent", "success", "warning", "error", "info"]);

const LEGACY_FIELDS = [
  "model",
  "permission",
  "prompt",
  "disable",
  "disabled",
  "temperature",
  "top_p",
  "maxSteps",
  "tools",
];

function agentColor(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hue = (h >>> 0) % 360;
  const sat = 0.68;
  const light = 0.52;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function shouldDeriveColor(current) {
  if (!current) return true;
  return THEME_COLORS.has(current.trim().toLowerCase());
}

function yamlColor(value) {
  return value.startsWith("#") ? `"${value}"` : value;
}

function unquoteColor(raw) {
  return (raw ?? "").trim().replace(/^["']/, "").replace(/["']$/, "");
}

function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: null, body: content };
  return { frontmatter: match[1], body: content.slice(match[0].length) };
}

function stripLegacyFields(frontmatter) {
  const lines = frontmatter.split(/\r?\n/);
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const key = lines[i].match(/^([A-Za-z0-9_-]+):/)?.[1];
    if (key && LEGACY_FIELDS.includes(key)) {
      i++;
      while (i < lines.length && /^\s+\S/.test(lines[i])) i++;
      i--;
      continue;
    }
    kept.push(lines[i]);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function setScalar(frontmatter, key, value) {
  const line = `${key}: ${value}`;
  const lines = frontmatter.split(/\r?\n/);
  const index = lines.findIndex((current) => current.startsWith(`${key}:`));
  if (index === -1) return frontmatter ? `${line}\n${frontmatter}` : line;
  lines[index] = line;
  return lines.join("\n");
}

function permissionsYaml(permissions) {
  return [
    "permissions:",
    ...permissions.flatMap((p) => [
      `  - action: ${p.action}`,
      // Quoted on purpose: a bare `*` is a YAML alias, so `resource: *` fails to parse and opencode then drops
      // the whole frontmatter, including `mode`, and refuses to spawn the agent ("cannot run as a subagent").
      `    resource: ${JSON.stringify(p.resource)}`,
      `    effect: ${p.effect}`,
    ]),
  ].join("\n");
}

function colorLineFor(name, rawCurrent) {
  const current = unquoteColor(rawCurrent);
  const target = shouldDeriveColor(current) ? agentColor(name) : current;
  const rendered = yamlColor(target);
  return (rawCurrent ?? "").trim() === rendered ? null : `color: ${rendered}`;
}

function normalizeTemplate(content, name) {
  const { frontmatter, body } = splitFrontmatter(content);
  if (frontmatter === null) {
    return `---\nmode: subagent\ncolor: ${yamlColor(agentColor(name))}\n---\n\n${content}`;
  }
  let fm = stripLegacyFields(frontmatter);
  fm = setScalar(fm, "mode", "subagent");
  const colorLine = colorLineFor(name, fm.match(/^color:\s*(.+)$/m)?.[1]);
  if (colorLine) fm = setScalar(fm, "color", colorLine.slice("color: ".length));
  return `---\n${fm}\n---\n${body}`;
}

function buildVariant(templateContent, model) {
  const { frontmatter, body } = splitFrontmatter(templateContent);
  let fm = stripLegacyFields(frontmatter ?? "");
  fm = setScalar(fm, "mode", "subagent");
  fm = setScalar(fm, "model", model);
  fm = setScalar(fm, "hidden", "true");
  if (!/^color:/m.test(fm)) {
    fm = setScalar(fm, "color", yamlColor(agentColor("engineer")));
  }
  return `---\n${fm}\n---\n${body}`;
}

function buildPrimary(spec, fullstackContent, model) {
  const { body } = splitFrontmatter(fullstackContent);
  const lines = ["---", `description: ${spec.description}`, `mode: ${spec.mode ?? "primary"}`];
  if (model) lines.push(`model: ${model}`);
  lines.push(`color: ${yamlColor(spec.color)}`);
  if (spec.permissions) lines.push(permissionsYaml(spec.permissions));
  lines.push("---");
  return `${lines.join("\n")}\n\n${body.trim()}\n`;
}

function buildPlannerSub(fullstackContent, model) {
  const { body } = splitFrontmatter(fullstackContent);
  const lines = [
    "---",
    "description: Spawnable planner alias for the task tool. Uses the plan model and cannot spawn workers.",
    "mode: subagent",
  ];
  if (model) lines.push(`model: ${model}`);
  lines.push(`color: ${yamlColor(agentColor("planner-sub"))}`);
  lines.push("hidden: true");
  lines.push(permissionsYaml([{ action: "subagent", resource: "*", effect: "deny" }]));
  lines.push("---");
  return `${lines.join("\n")}\n\n${body.trim()}\n`;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch {
    return null;
  }
}

async function scanEngineers(agentsDir) {
  try {
    const entries = await fs.readdir(agentsDir);
    return {
      templates: entries
        .filter((f) => /^[\w-]+-engineer\.md$/.test(f) && f !== FULLSTACK_TEMPLATE)
        .map((f) => f.replace(/\.md$/, "")),
      variantFiles: entries.filter((f) => /^[\w-]+-engineer\.(build|fast|plan)\.md$/.test(f)),
      hasFullstack: entries.includes(FULLSTACK_TEMPLATE),
    };
  } catch {
    return { templates: [], variantFiles: [], hasFullstack: false };
  }
}

async function writeIfChanged(filePath, content) {
  try {
    if ((await fs.readFile(filePath, "utf-8")) === content) return false;
  } catch {
    // file missing, write it
  }
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, content, "utf-8");
  await fs.rename(tmpPath, filePath);
  return true;
}

function isModelId(value) {
  return typeof value === "string" && /^[^/\s]+\/[^/\s]+$/.test(value);
}

export async function generateAgents({ root, writeManifest = true } = {}) {
  if (!root) throw new Error("generateAgents requires a root directory");
  const agentsDir = path.join(root, ".opencode", "agents");
  const [user, team] = await Promise.all([
    readJson(path.join(root, ".opencode", "harness.user.json")),
    readJson(path.join(root, ".opencode", "harness.json")),
  ]);

  const models = {};
  const sources = {};
  const warnings = [];
  for (const tier of TIERS) {
    const fromUser = user?.models?.[tier];
    const fromTeam = team?.models?.[tier];
    models[tier] = fromUser ?? fromTeam ?? null;
    sources[tier] = fromUser ? "user" : fromTeam ? "team" : "missing";
    if (!models[tier]) {
      warnings.push(`tier ${tier} has no model; its agents inherit the session model`);
    } else if (!isModelId(models[tier])) {
      warnings.push(`tier ${tier} model "${models[tier]}" is not provider/model`);
    }
  }

  const available = TIERS.filter((tier) => models[tier]);
  const { templates, variantFiles, hasFullstack } = await scanEngineers(agentsDir);
  const manifest = {
    generatedAt: new Date().toISOString(),
    models,
    source: sources,
    agents: {},
    warnings,
  };

  if (hasFullstack) {
    const fullstackPath = path.join(agentsDir, FULLSTACK_TEMPLATE);
    const rawFullstack = await fs.readFile(fullstackPath, "utf-8");
    const fullstack = normalizeTemplate(rawFullstack, FULLSTACK_NAME);
    if (fullstack !== rawFullstack) await writeIfChanged(fullstackPath, fullstack);

    for (const [name, spec] of Object.entries(PRIMARIES)) {
      await writeIfChanged(path.join(agentsDir, `${name}.md`), buildPrimary(spec, fullstack, models[spec.tier]));
      manifest.agents[name] = {
        file: `${name}.md`,
        mode: spec.mode ?? "primary",
        model: models[spec.tier] ?? null,
      };
    }
    await writeIfChanged(path.join(agentsDir, "planner-sub.md"), buildPlannerSub(fullstack, models.plan));
    manifest.agents["planner-sub"] = {
      file: "planner-sub.md",
      mode: "subagent",
      model: models.plan ?? null,
      hidden: true,
    };
  } else {
    warnings.push(`${FULLSTACK_TEMPLATE} missing: build, plan, planner and planner-sub not generated`);
  }

  const keepSet = new Set();
  const variants = [];
  for (const name of templates) {
    const rawContent = await fs.readFile(path.join(agentsDir, `${name}.md`), "utf-8");
    const content = normalizeTemplate(rawContent, name);
    if (content !== rawContent) await writeIfChanged(path.join(agentsDir, `${name}.md`), content);
    for (const tier of available) {
      const file = `${name}.${tier}.md`;
      variants.push({ file, path: path.join(agentsDir, file), content: buildVariant(content, models[tier]) });
      keepSet.add(file);
      manifest.agents[name] ??= {};
      manifest.agents[name][tier] = { file, model: models[tier], hidden: true };
    }
  }

  await Promise.all(variants.map((variant) => writeIfChanged(variant.path, variant.content)));
  await Promise.all(
    variantFiles.filter((file) => !keepSet.has(file)).map((file) => fs.unlink(path.join(agentsDir, file)).catch(() => {})),
  );

  if (templates.length === 0) warnings.push("no *-engineer.md templates found; no tier variants generated");

  if (writeManifest) {
    await fs.mkdir(path.join(root, ".opencode"), { recursive: true });
    await writeIfChanged(path.join(root, ".opencode", MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return {
    models,
    sources,
    warnings,
    manifest,
    templates,
    variants: variants.map((variant) => variant.file),
    hasFullstack,
  };
}
