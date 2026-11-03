import fs from 'node:fs'
import path from 'node:path'

export const ANSWERS_FILE = '.copier-answers.yml'
export const MANIFEST_FILE = '.platform/manifest'
export const EXCEPTIONS_FILE = '.platform/exceptions.yml'

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

export function globToRegExp(glob) {
  const directory = glob.endsWith('/')
  const body = glob.replace(/\/$/, '')
  const anchored = body.includes('/')
  const pattern = body.replace(/^\//, '')
  let source = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*' && pattern[i + 1] === '*' && (i === 0 || pattern[i - 1] === '/')) {
      if (i + 2 === pattern.length) {
        source += '.*'
        i += 1
        continue
      }
      if (pattern[i + 2] === '/') {
        source += '(?:.*/)?'
        i += 2
        continue
      }
    }
    if (c === '*') {
      source += '[^/]*'
      while (pattern[i + 1] === '*') i++
    } else if (c === '?') source += '[^/]'
    else if (c === '[' && pattern.indexOf(']', i + 2) !== -1) {
      const end = pattern.indexOf(']', i + 2)
      source += `[${pattern.slice(i + 1, end).replace(/^!/, '^')}]`
      i = end
    } else if (c === '\\' && i + 1 < pattern.length) source += escapeRegExp(pattern[++i])
    else source += escapeRegExp(c)
  }
  return new RegExp(`^${anchored ? '' : '(?:.*/)?'}${source}${directory ? '/.*' : '(?:/.*)?'}$`)
}

export function parseManifest(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/(?<!\\)\s+$/, ''))
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const negated = line.startsWith('!')
      return { negated, regex: globToRegExp(negated ? line.slice(1) : line) }
    })
}

export function matchesRules(rules, file) {
  let matched = false
  for (const rule of rules) if (rule.regex.test(file)) matched = !rule.negated
  return matched
}

const scalar = raw => {
  const value = raw.trim()
  const quoted = value.match(/^(["'])(.*)\1$/)
  return quoted ? quoted[2] : value.replace(/\s+#.*$/, '')
}

export function parseExceptions(text) {
  const exceptions = []
  let current
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#') || /^exceptions:/.test(line)) continue
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item) exceptions.push((current = {}))
    const pair = (item ? item[1] : line).match(/^\s*([A-Za-z_]+):\s*(.*)$/)
    if (pair && current) current[pair[1]] = scalar(pair[2])
  }
  return exceptions
}

export function commitOf(answers) {
  const match = answers?.match(/^_commit:\s*(.+)$/m)
  return match ? scalar(match[1]) : null
}

const localDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

// A repository opts in by carrying both files; without them every caller behaves exactly as before.
export function loadPlatform(root) {
  if (!fs.existsSync(path.join(root, ANSWERS_FILE))) return null
  const manifest = readText(path.join(root, MANIFEST_FILE))
  if (manifest == null) return null
  return {
    rules: parseManifest(manifest),
    exceptions: parseExceptions(readText(path.join(root, EXCEPTIONS_FILE)) ?? ''),
  }
}

export function isPlatformOwned(platform, file, today = localDate()) {
  const relative = file.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!matchesRules(platform.rules, relative)) return false
  return !platform.exceptions.some(e =>
    typeof e.path === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.expires ?? '') && e.expires >= today && globToRegExp(e.path).test(relative))
}
