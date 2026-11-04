import fs from 'node:fs'
import path from 'node:path'

export const CONTRACT_FILE = '.platform/contract.yml'
const DEFAULT_EXCEPTIONS = '.platform/exceptions.yml'
const LEGACY_ANSWERS = '.copier-answers.yml'
const LEGACY_MANIFEST = '.platform/manifest'

export class ContractError extends Error {}

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

const toRules = globs => globs.map(glob => {
  const negated = glob.startsWith('!')
  return { negated, regex: globToRegExp(negated ? glob.slice(1) : glob) }
})

function matchesRules(rules, file) {
  let matched = false
  for (const rule of rules) if (rule.regex.test(file)) matched = !rule.negated
  return matched
}

function stripComment(line) {
  let quote = null
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quote) quote = c === quote ? null : quote
    else if ((c === '"' || c === "'") && (i === 0 || /[\s[,]/.test(line[i - 1]))) quote = c
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i)
  }
  return line
}

function scalar(raw) {
  const value = raw.trim()
  const quoted = value.match(/^(["'])(.*)\1$/)
  if (quoted) return quoted[2]
  if (value.startsWith('[') && value.endsWith(']')) return value.slice(1, -1).split(',').map(scalar).filter(item => item !== '')
  return /^-?\d+$/.test(value) ? Number(value) : value
}

const isItem = text => text === '-' || text.startsWith('- ')

// The subset of YAML a contract and its exceptions use: nested mappings, block and flow lists, scalars.
export function parseYaml(text, file) {
  const lines = []
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((raw, index) => {
    const body = stripComment(raw).trimEnd()
    if (body.trim()) lines.push({ indent: body.length - body.trimStart().length, text: body.trim(), number: index + 1 })
  })
  const fail = line => {
    throw new ContractError(`${file}: line ${line.number} cannot be read: \`${line.text}\`.`)
  }

  function block(start, indent) {
    const list = isItem(lines[start].text)
    const value = list ? [] : {}
    let i = start
    while (i < lines.length && lines[i].indent === indent) {
      const line = lines[i]
      if (isItem(line.text) !== list) {
        if (list) break
        fail(line)
      }
      if (list) {
        const rest = line.text.slice(1).trimStart()
        if (/^[^"'[{][^:]*:(\s|$)/.test(rest)) {
          lines[i] = { ...line, indent: indent + line.text.length - rest.length, text: rest }
        } else {
          i++
          if (rest || !(i < lines.length && lines[i].indent > indent)) {
            value.push(rest ? scalar(rest) : null)
            continue
          }
        }
        const [item, after] = block(i, lines[i].indent)
        value.push(item)
        i = after
        continue
      }
      const pair = line.text.match(/^([^:]+?)\s*:(?:\s+(.*))?$/)
      if (!pair) fail(line)
      const key = scalar(pair[1])
      i++
      const next = lines[i]
      if (pair[2]) value[key] = scalar(pair[2])
      else if (next && (next.indent > indent || (next.indent === indent && isItem(next.text)))) [value[key], i] = block(i, next.indent)
      else value[key] = null
    }
    if (i < lines.length && lines[i].indent > indent) fail(lines[i])
    return [value, i]
  }

  if (!lines.length) return null
  const [value, end] = block(0, lines[0].indent)
  if (end < lines.length) fail(lines[end])
  return value
}

const isText = value => typeof value === 'string' && value.trim() !== ''
const isMapping = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const invalid = (file, field, problem) => new ContractError(`${file}: \`${field}\` ${problem}`)

function mapping(value, file, field, required = false) {
  if (value == null && !required) return {}
  if (!isMapping(value)) throw invalid(file, field, required ? 'is required and must be a mapping.' : 'must be a mapping.')
  return value
}

function text(value, file, field, fallback) {
  if (value == null && fallback !== undefined) return fallback
  if (!isText(value)) throw invalid(file, field, fallback === undefined ? 'is required and must be a non-empty string.' : 'must be a non-empty string.')
  return value
}

function textList(value, file, field) {
  if (value == null) return []
  const list = Array.isArray(value) ? value : [value]
  if (!list.every(isText)) throw invalid(file, field, 'must be a list of non-empty strings.')
  return list
}

export function readContract(source, file = CONTRACT_FILE) {
  const raw = parseYaml(source, file)
  if (!isMapping(raw)) throw new ContractError(`${file}: expected a mapping with \`version\`, \`source\` and \`owned\`.`)
  if (raw.version == null) throw invalid(file, 'version', 'is required.')
  if (String(raw.version) !== '1') throw invalid(file, 'version', `is ${raw.version}; this harness reads version 1.`)
  const origin = mapping(raw.source, file, 'source', true)
  const url = text(origin.url, file, 'source.url')
  const owned = textList(raw.owned, file, 'owned')
  if (!owned.length) throw invalid(file, 'owned', 'is required and must list at least one path.')
  const reuse = mapping(raw.reuse, file, 'reuse')
  const sync = mapping(raw.sync, file, 'sync')
  const version = sync.version == null ? null : mapping(sync.version, file, 'sync.version')
  return {
    file,
    source: { name: text(origin.name, file, 'source.name'), url, changes: text(origin.changes, file, 'source.changes', url) },
    owned,
    reuse: { docs: textList(reuse.docs, file, 'reuse.docs'), packages: textList(reuse.packages, file, 'reuse.packages'), names: textList(reuse.names, file, 'reuse.names') },
    exceptions: text(raw.exceptions, file, 'exceptions', DEFAULT_EXCEPTIONS),
    sync: {
      marker: text(sync.marker, file, 'sync.marker', null),
      version: version && { file: text(version.file, file, 'sync.version.file'), key: text(version.key, file, 'sync.version.key') },
      update: text(sync.update, file, 'sync.update', null),
    },
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

// What harness 3.7.0 read before contract.yml existed: Copier answers plus a manifest of owned globs.
function legacyContract(root) {
  const answers = readText(path.join(root, LEGACY_ANSWERS))
  const manifest = answers == null ? null : readText(path.join(root, LEGACY_MANIFEST))
  if (manifest == null) return null
  const srcLine = answers.match(/^_src_path:(.*)$/m)
  const url = srcLine ? scalar(stripComment(srcLine[1])) || null : null
  const owned = manifest.split(/\r?\n/).map(line => line.replace(/(?<!\\)\s+$/, '')).filter(line => line && !line.startsWith('#'))
  return {
    file: LEGACY_MANIFEST,
    source: { name: url ? url.replace(/\.git$/, '').split(/[\\/:]/).filter(Boolean).pop() : 'the upstream template', url, changes: url },
    owned,
    reuse: { docs: [], packages: [], names: [] },
    exceptions: DEFAULT_EXCEPTIONS,
    sync: { marker: LEGACY_ANSWERS, version: { file: LEGACY_ANSWERS, key: '_commit' }, update: 'copier update --trust --defaults --conflict inline' },
  }
}

export function loadContract(root) {
  const source = readText(path.join(root, CONTRACT_FILE))
  const contract = source == null ? legacyContract(root) : readContract(source)
  if (!contract) return null
  const exceptions = readText(path.join(root, contract.exceptions))
  const entries = exceptions == null ? null : parseYaml(exceptions, contract.exceptions)?.exceptions
  return { ...contract, rules: toRules(contract.owned), exceptionList: Array.isArray(entries) ? entries.filter(isMapping) : [] }
}

const localDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

export function isOwned(contract, file, today = localDate()) {
  const relative = file.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!matchesRules(contract.rules, relative)) return false
  return !contract.exceptionList.some(e =>
    isText(e.path) && /^\d{4}-\d{2}-\d{2}$/.test(String(e.expires ?? '')) && e.expires >= today && globToRegExp(e.path).test(relative))
}

export function describeOwner(contract) {
  const { name, changes } = contract.source
  return {
    owner: `owned by ${name} (listed in ${contract.file})`,
    fix: `Ask for the change ${changes ? `at ${changes}` : `in ${name}`}, or add a dated exception to ${contract.exceptions}.`,
  }
}

export const nameKey = name => name.toLowerCase().replace(/[-_.\s]/g, '')

export function declaredExports(declarations) {
  const names = [...declarations.matchAll(/^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:function\*?|const|let|var|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1])
  for (const list of declarations.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const item of list[1].split(',')) {
      const name = item.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()
      if (name && name !== 'default') names.push(name)
    }
  }
  return names
}

function packageNames(directory) {
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'))
  } catch {
    return []
  }
  const exportsMap = isMapping(manifest.exports) ? manifest.exports : {}
  const subpaths = Object.keys(exportsMap)
    .filter(key => key.startsWith('./') && !key.includes('*') && !/\.[a-z]+$/i.test(key))
    .map(key => path.posix.basename(key))
  const root = exportsMap['.'] ?? exportsMap
  const types = manifest.types ?? manifest.typings ?? (isText(root.types) ? root.types : null)
  const declarations = isText(types) ? readText(path.join(directory, types)) : null
  return [...subpaths, ...(declarations ? declaredExports(declarations) : [])]
}

// Packages resolve from the nearest node_modules, so a workspace app finds what its own package.json installs.
export function reusableNames(root, contract, files = []) {
  const names = new Map()
  const add = (name, origin) => {
    const key = nameKey(name)
    if (key && !names.has(key)) names.set(key, { name, origin })
  }
  for (const name of contract.reuse.names) add(name, contract.file)
  const base = path.resolve(root)
  const directories = new Set([base])
  for (const file of files) {
    for (let dir = path.dirname(path.resolve(base, file)); dir.length > base.length && dir.startsWith(base); dir = path.dirname(dir)) directories.add(dir)
  }
  for (const pkg of contract.reuse.packages) {
    for (const dir of directories) {
      const installed = path.join(dir, 'node_modules', pkg)
      if (fs.existsSync(path.join(installed, 'package.json'))) for (const name of packageNames(installed)) add(name, pkg)
    }
  }
  return names
}
