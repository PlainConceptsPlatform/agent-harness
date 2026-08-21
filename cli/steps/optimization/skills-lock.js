import fse from 'fs-extra'
import path from 'path'
import { info, warn } from '../../utils/exec.js'

export async function addSkillToLock(skillName, entry) {
  if (!entry) {
    warn(`No entry provided for skills-lock.json: ${skillName}`)
    return false
  }

  const destLock = path.join(process.cwd(), 'skills-lock.json')

  let lock = { version: 1, skills: {} }
  if (await fse.pathExists(destLock)) {
    try {
      lock = await fse.readJson(destLock)
      if (!lock.skills) lock.skills = {}
    } catch {
      warn('Could not parse existing skills-lock.json, creating fresh')
    }
  }

  if (!lock.skills[skillName]) {
    lock.skills[skillName] = entry
    await fse.writeJson(destLock, lock, { spaces: 2 })
    info(`Added ${skillName} to skills-lock.json`)
  }

  return true
}
