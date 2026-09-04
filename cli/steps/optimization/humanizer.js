import { addSkillToLock } from './skills-lock.js'
import { header, success, info } from '../../utils/exec.js'

const SKILL_ENTRY = {
  source: 'blader/humanizer',
  sourceType: 'github',
  skillPath: 'SKILL.md',
}

export async function installHumanizer(options = {}) {
  if (!options.skipHeader) header('Installing humanizer')

  info('Adding humanizer to skills-lock.json for batch install')
  await addSkillToLock('humanizer', SKILL_ENTRY)
  success('humanizer queued for installation')
  return { optedIn: true, installed: true }
}
