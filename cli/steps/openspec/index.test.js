import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("execa")
vi.mock("../../utils/exec.js")

import { execa } from "execa"
import { commandExists } from "../../utils/exec.js"
import { initOpenspec } from "./index.js"

const initOpenSpecMock = vi.mocked(execa)
const installOpenSpecMock = vi.mocked(execa)

const installFails = () => installOpenSpecMock.mockRejectedValueOnce({ exitCode: 1 })
const installSuccess = () => installOpenSpecMock.mockResolvedValueOnce(/** @type {any} */ ({ exitCode: 0 }))
const initSuccess = () => initOpenSpecMock.mockResolvedValueOnce(/** @type {any} */ ({ exitCode: 0 }))
const initFails = () => initOpenSpecMock.mockRejectedValueOnce({ exitCode: 1 })
const checkFails = () => vi.mocked(commandExists).mockResolvedValueOnce(false)
const checkSuccess = () => vi.mocked(commandExists).mockResolvedValueOnce(true)

describe("initOpenspec()", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("installs and initializes when openspec is initially unavailable", async () => {
    checkFails()
    installSuccess()
    checkSuccess()
    initSuccess()

    const result = await initOpenspec()

    expect(result.available).toBe(true)
    expect(result.initialized).toBe(true)

    expect(installOpenSpecMock).toHaveBeenCalledWith(
      "npm",
      ["install", "@fission-ai/openspec", "--global"],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: "pipe",
        reject: false,
      }),
    )

    expect(initOpenSpecMock).toHaveBeenCalledWith(
      "npx",
      ["@fission-ai/openspec", "init", "--tools", "opencode", "--force"],
      expect.objectContaining({
        cwd: process.cwd(),
        reject: false,
      }),
    )
  })

  it("fails if openspec remains unavailable after install", async () => {
    checkFails()
    installFails()
    checkFails()

    const result = await initOpenspec()

    expect(result.available).toBe(false)
    expect(result.initialized).toBe(false)
  })

  it("fails if openspec init command exits non-zero", async () => {
    checkFails()
    checkSuccess()
    installSuccess()
    initFails()

    const result = await initOpenspec()

    expect(result.available).toBe(true)
    expect(result.initialized).toBe(false)
  })
})
