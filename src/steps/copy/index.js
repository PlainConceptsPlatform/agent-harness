import fse from "fs-extra"
import path from "path"
import { fileURLToPath } from "url"
import { copyContent, recordManagedContent } from "../../utils/copy.js"
import { error, header, success } from "../../utils/exec.js"
import { exit } from "../../utils/process.js"
import { patchAgentGuidance, patchAgentsMd } from "./agents.js"
import { patchArchiveCommand, patchOpsShip, patchOpsReview, patchOpsBacklog, patchOpsEvidence } from "./commands.js"
import { installSkills } from "./skills.js"
import { generateFullstackEngineer, removeLegacyStartupDirectives } from "./fullstack-engineer.js"
import { patchOpencodeJson, patchOpencodePackage } from "./opencode-json.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, "../../content")

export async function copyContentStep(platform, ctx = {}) {
  header("Step 5, Copying agent-harness files")

  const dest = process.cwd()

  // Support both old single-string platform and new { backlogPlatform, repoPlatform }
  const backlogPlatform = typeof platform === 'object' ? platform.backlogPlatform : platform
  const repoPlatform = typeof platform === 'object' ? platform.repoPlatform : platform

  try {
    await copyContent(CONTENT_DIR, dest, platform, ctx)

    // .gitignore is stripped by npm during publish, so the source file is _gitignore.
    // Also, fse.copy with overwrite:false won't overwrite an existing .gitignore,
    // so merge manually to preserve both opencode's defaults and our additions.
    const srcGitignore = path.join(CONTENT_DIR, ".opencode", "_gitignore")
    const destGitignore = path.join(dest, ".opencode", ".gitignore")
    if (await fse.pathExists(srcGitignore)) {
      const srcLines = (await fse.readFile(srcGitignore, "utf-8")).split("\n").map(l => l.trim()).filter(Boolean)
      const destLines = (await fse.pathExists(destGitignore))
        ? (await fse.readFile(destGitignore, "utf-8")).split("\n").map(l => l.trim()).filter(Boolean)
        : []
      const merged = Array.from(new Set([...destLines, ...srcLines]))
      await fse.writeFile(destGitignore, `${merged.join("\n")}\n`, "utf-8")
    }

    // Remove the _gitignore template from dest: it was only needed for the merge above.
    const destGitignoreTemplate = path.join(dest, ".opencode", "_gitignore")
    if (await fse.pathExists(destGitignoreTemplate)) {
      await fse.remove(destGitignoreTemplate)
    }

    const rootsFile = path.join(dest, ".opencode", "source-roots.json")
    if (!ctx.updateMode || !await fse.pathExists(rootsFile)) {
      await fse.writeJson(
        rootsFile,
        {
          mode: ctx.sourceMode || "current",
          // An empty array is truthy, so `|| [dest]` never kicked in and reruns
          // wrote `roots: []`, leaving agents with no source scope.
          roots: ctx.sourceRoots?.length ? ctx.sourceRoots : [dest],
        },
        { spaces: 2 },
      )
    }

    await patchAgentGuidance(backlogPlatform, repoPlatform)
    await patchOpsReview({ backlogPlatform, repoPlatform })
    await patchOpsBacklog({ backlogPlatform, repoPlatform })
    await patchOpencodeJson()
    await patchOpencodePackage()
    if (!ctx.updateMode) await patchAgentsMd(ctx)

    if (!ctx.skipSkills) {
      await installSkills(backlogPlatform, repoPlatform, {
        forceOverwrite: ctx.forceOverwrite,
        updateMode: ctx.updateMode,
      })
    }
    // These patch SKILL.md files (pc-plan-archive, pc-ops-ship, pc-ops-evidence),
    // so they must run after installSkills has copied the skills into the project.
    await patchArchiveCommand({ backlogPlatform, repoPlatform })
    await patchOpsShip({ backlogPlatform, repoPlatform })
    await patchOpsEvidence({ backlogPlatform, repoPlatform })
    await generateFullstackEngineer({ updateMode: ctx.updateMode })
    await removeLegacyStartupDirectives()
    await recordManagedContent(CONTENT_DIR, dest, { updateMode: ctx.updateMode })
    success("Files copied to project root")
  } catch (err) {
    error(`Failed to copy content: ${err.message}`)
    exit(1)
  }
}
