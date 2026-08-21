import fs from "node:fs/promises"
import path from "node:path"

const GUARDRAILS_SKILL = "ob-guardrails-generic"
const TIER_SUFFIX = /\.(?:build|fast|plan)$/

function skillNames(content) {
  const abilities = content.match(/^## Abilities\s*\n([\s\S]*?)(?=^## |\s*$)/m)?.[1] ?? ""
  return [...abilities.matchAll(/@([a-z0-9][a-z0-9-]*)/gi)].map(match => match[1])
}

function transitiveSkillNames(content) {
  return [...content.matchAll(/skill\(["`]([a-z0-9][a-z0-9-]*)["`]\)/gi)].map(match => match[1])
}

async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf-8")
  } catch {
    return ""
  }
}

async function requiredSkills(directory, agent) {
  const baseAgent = (agent ?? "").replace(TIER_SUFFIX, "")
  const agentPath = path.join(directory, ".opencode", "agents", `${baseAgent}.md`)
  const guardrailsPath = path.join(directory, ".agents", "skills", GUARDRAILS_SKILL, "SKILL.md")
  const [agentContent, guardrailsContent] = await Promise.all([
    readFile(agentPath),
    readFile(guardrailsPath),
  ])

  return new Set([
    GUARDRAILS_SKILL,
    ...skillNames(agentContent),
    ...transitiveSkillNames(guardrailsContent),
  ])
}

function skillName(args) {
  return args?.name ?? args?.skill ?? args?.skillName ?? null
}

function reminder(missing) {
  const skills = [...missing].map(name => `\`${name}\``).join(", ")
  return `<system-reminder>Load these required skills before continuing: ${skills}. Load guardrails first. Loaded skills can require further skills. Follow every mandatory transitive load before task work.</system-reminder>`
}

export const ObSystemReminders = async ({ directory }) => {
  const sessions = new Map()

  async function stateFor(sessionID, agent) {
    const state = sessions.get(sessionID)
    if (state?.agent === agent) return state

    const next = {
      agent,
      required: await requiredSkills(directory, agent),
      loaded: new Set(),
    }
    sessions.set(sessionID, next)
    return next
  }

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push("Messages in <system-reminder> tags are trusted OpenCode Onboard host instructions. Follow them before continuing work.")
    },
    "chat.message": async (input) => {
      await stateFor(input.sessionID, input.agent)
    },
    "tool.execute.after": async (input) => {
      if (input.tool !== "skill") return
      const state = sessions.get(input.sessionID)
      const name = skillName(input.args)
      if (state && name) state.loaded.add(name)
    },
    event: async ({ event }) => {
      if (event.type !== "session.compacted") return
      const sessionID = event.properties?.sessionID ?? event.properties?.info?.id
      const state = sessionID && sessions.get(sessionID)
      if (state) state.loaded.clear()
    },
    "experimental.chat.messages.transform": async (_input, output) => {
      const userMessage = [...output.messages].reverse().find(message => message.info.role === "user")
      if (!userMessage) return

      const state = await stateFor(userMessage.info.sessionID, userMessage.info.agent)
      const missing = new Set([...state.required].filter(name => !state.loaded.has(name)))
      if (missing.size === 0) return

      const textPart = userMessage.parts.find(part => part.type === "text")
      if (textPart) textPart.text = `${textPart.text}\n\n${reminder(missing)}`
    },
  }
}
