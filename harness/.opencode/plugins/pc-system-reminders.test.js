import { describe, expect, it } from "vitest"
import { PcSystemReminders } from "./pc-system-reminders.js"

describe("PcSystemReminders", () => {
  it("reminds an agent to load its abilities before work", async () => {
    const plugin = await PcSystemReminders({ directory: process.cwd() })
    const output = {
      messages: [{
        info: { role: "user", sessionID: "session-1", agent: "missing-agent" },
        parts: [{ type: "text", text: "Implement the change" }],
      }],
    }

    await plugin["chat.message"]({ sessionID: "session-1", agent: "missing-agent" })
    await plugin["experimental.chat.messages.transform"]({}, output)

    expect(output.messages[0].parts[0].text).toContain("pc-guardrails-generic")
  })

  it("stops reminding after the required guardrail loads", async () => {
    const plugin = await PcSystemReminders({ directory: process.cwd() })
    const output = {
      messages: [{
        info: { role: "user", sessionID: "session-2", agent: "missing-agent" },
        parts: [{ type: "text", text: "Implement the change" }],
      }],
    }

    await plugin["chat.message"]({ sessionID: "session-2", agent: "missing-agent" })
    await plugin["tool.execute.after"]({ tool: "skill", sessionID: "session-2", args: { name: "pc-guardrails-generic" } })
    await plugin["experimental.chat.messages.transform"]({}, output)

    expect(output.messages[0].parts[0].text).not.toContain("system-reminder")
  })
})
