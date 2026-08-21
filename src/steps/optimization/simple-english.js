import { addSkillToLock } from './skills-lock.js'
import { header, success, info } from '../../utils/exec.js'

const SKILL_ENTRY = {
  source: 'AminBlg/SimpleEnglish',
  sourceType: 'github',
  skillPath: 'skills/simple-english/SKILL.md',
}

export async function installSimpleEnglish(options = {}) {
  if (!options.skipHeader) header('Installing Simple English')

  info('Adding Simple English to skills-lock.json for batch install')
  await addSkillToLock('simple-english', SKILL_ENTRY)
  success('Simple English queued for installation')
  return { optedIn: true, installed: true }
}
