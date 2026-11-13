// pc-subagent-tiers: on startup, generates the primary agents, the spawnable
// planner alias and the tier variants from *-engineer.md templates, then pins
// the primaries in memory. The generation itself lives in
// pc-subagent-tiers-core.js so a CI pre-start step can write the same files
// before OpenCode builds its task enum.

import { Plugin, Model } from "@opencode/plugin";
import { PRIMARIES, generateAgents } from "../scripts/pc-subagent-tiers-core.js";

export default Plugin.define({
  id: "pc.subagent-tiers",
  async setup(ctx) {
    const root = ctx.location.directory;

    try {
      const result = await generateAgents({ root });

      console.error(
        `[pc-subagent-tiers] Wrote primaries: build (${result.models.build ?? "session model"}), plan and planner (${result.models.plan ?? "session model"})`,
      );
      if (result.variants.length > 0) {
        console.error(
          `[pc-subagent-tiers] Created ${result.variants.length} variant files (${result.templates.length} engineers x ${Object.values(result.models).filter(Boolean).length} tiers)`,
        );
      } else if (result.templates.length > 0) {
        console.error(`[pc-subagent-tiers] No variants created. Models: ${JSON.stringify(result.models)}`);
      }
      for (const warning of result.warnings) {
        console.error(`[pc-subagent-tiers] Warning: ${warning}`);
      }

      if (typeof ctx.agent?.transform === "function") {
        await ctx.agent.transform((editor) => {
          for (const [id, spec] of Object.entries(PRIMARIES)) {
            const existing = editor.get(id);
            if (!existing) continue;
            const model = result.models[spec.tier];
            if (model) {
              try {
                existing.model = Model.Ref.parse(model);
              } catch {
                // invalid model ref; leave undefined so the session model applies
              }
            }
            existing.mode = spec.mode ?? "primary";
            existing.description = spec.description;
            if (spec.permissions) existing.permissions = spec.permissions;
          }
        });
        await ctx.agent.reload?.();
      }
    } catch (error) {
      console.error(`[pc-subagent-tiers] Error: ${error?.message}`);
    }
  },
});
