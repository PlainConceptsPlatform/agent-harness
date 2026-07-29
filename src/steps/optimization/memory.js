import { execa } from 'execa'
import { addSkillToLock } from './skills-lock.js'
import fse from 'fs-extra'
import path from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'
import { error, info, loading, success, warn } from '../../utils/exec.js'

/**
 * Configures the agentmemory MCP server in opencode.jsonc
 * and installs the agentmemory skills.
 *
 * agentmemory runs as a persistent local server on localhost:3111.
 * Requires Node.js 18+ (npm install -g @agentmemory/agentmemory).
 * MCP bridge: npx -y @agentmemory/mcp (proxies to the running server).
 * Skill source: https://github.com/rohitg00/agentmemory
 */
export async function installMemory(options = {}) {
  if (!options.skipHeader) info('Configuring agentmemory local memory server...')

  // Install agentmemory globally so the `agentmemory` command is on PATH
  loading('installing agentmemory (this may take a minute)...')
  try {
    const installResult = await execa('npm', ['install', '-g', '@agentmemory/agentmemory'], {
      reject: false,
      timeout: 300000,
      stdio: 'pipe',
    })
    if (installResult.exitCode === 0) {
      success('agentmemory installed')
    } else {
      warn('agentmemory install exited with non-zero code, MCP may fall back to npx resolution')
    }
  } catch (err) {
    warn(`agentmemory install failed: ${err.message}`)
  }

  // Configure MCP server in opencode.jsonc
  try {
    const opencodePath = path.join(process.cwd(), 'opencode.jsonc')

    let opencode = { $schema: 'https://opencode.ai/config.json' }
    if (await fse.pathExists(opencodePath)) {
      const errors = []
      opencode = parseJsonc(await fse.readFile(opencodePath, 'utf-8'), errors)
      if (errors.length > 0 || !opencode || typeof opencode !== 'object' || Array.isArray(opencode)) {
        throw new Error('opencode.jsonc could not be parsed')
      }
    }

    if (!opencode.mcp) opencode.mcp = {}
    if (!opencode.mcp['agentmemory']) {
      opencode.mcp['agentmemory'] = {
        type: 'local',
        command: ['npx', '-y', '@agentmemory/mcp'],
        env: {
          AGENTMEMORY_URL: 'http://localhost:3111',
        },
        enabled: true,
        timeout: 120000,
      }
    }

    await fse.writeJson(opencodePath, opencode, { spaces: 2 })
    success('agentmemory MCP server configured in opencode.jsonc')
  } catch (err) {
    error(`Failed to configure agentmemory MCP: ${err.message}`)
    return { optedIn: true, installed: false }
  }

  // Add agentmemory skills to skills-lock.json for batch install
  await addSkillToLock('agentmemory-agents', {
    source: 'rohitg00/agentmemory',
    sourceType: 'github',
    skillPath: 'plugin/skills/agentmemory-agents/SKILL.md',
  })

  info('Memory server: run `agentmemory` to start on localhost:3111')
  info('Real-time viewer: http://localhost:3113')
  info('Health check: curl http://localhost:3111/agentmemory/health')

  return { optedIn: true, installed: true }
}
