import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { commentBlocks, countLines, isGenerated, kindOf, lineKinds, slopFindings, testStats } from './code-rules.mjs'

export const DEFAULT_LIMITS = {
  commentRatio: 0.1,
  commentAllowance: 2,
  testRatio: 1,
  testAllowance: 40,
  casesPerKloc: 40,
  caseAllowance: 3,
  complexityBaseline: 'scripts/complexity-baseline.json',
}

const FIX = {
  'comment-budget': 'Delete comments until the diff is within budget. Keep only one that explains a constraint the code cannot show: a third-party bug, an external contract, a legal requirement.',
  'banner': 'Delete the separator.',
  'region': 'Delete the region markers.',
  'untracked-todo': 'Link an issue or delete the TODO.',
  'restating-summary': 'Delete the doc comment: it repeats the name.',
  'restating-jsdoc': 'Delete the doc comment: it repeats the name.',
  'restating-param': 'Delete the parameter doc: it repeats the name.',
  'filler-returns': 'Delete the returns doc: it says nothing the signature does not.',
  'commented-out-code': 'Delete it; git keeps the history.',
  'apologetic': 'Make the code right or delete the note.',
  'history': 'Delete the incident story; it belongs in the commit message or the pull request.',
  'essay': 'Cut the block to one line or delete it; long explanations belong in docs or the pull request.',
  'internal-doc': 'Delete the doc comment: nothing outside the file calls this.',
  'touched-file-slop': 'This file is in the diff, so leave it clean: delete the finding even though it predates the change.',
  'touched-file-density': 'This file now has more comments per code line than before. Delete comments until it does not.',
  'test-budget': 'Too much test code for the change. Keep the tests of the public contract; a bug fix gets one regression test.',
  'case-budget': 'Too many test cases for the change. Merge or delete the ones that test internals or repeat each other.',
  'test-skipped': 'Delete the skipped test or make it run.',
  'test-focused': 'Remove .only / f-prefix: it hides every other test.',
  'test-snapshot': 'Assert the values that matter instead of a snapshot.',
  'test-no-assertion': 'Assert something, or delete the test.',
  'test-mock-only': 'Assert on state or output, not only that a mock was called.',
}

const SUSPICIOUS = {
  skipped: 'test-skipped',
  focused: 'test-focused',
  snapshot: 'test-snapshot',
  noAssertion: 'test-no-assertion',
  mockOnly: 'test-mock-only',
}

const EMPTY_STATS = { cases: 0, skipped: 0, focused: 0, snapshot: 0, noAssertion: 0, mockOnly: 0 }

// `tracked` holds the files a complexity gate has methods on record for. Their new lines buy twice
// the test budget: that gate fails a method whose coverage drops, so a change there needs its new
// branches tested, and trimming those tests to fit this budget is what broke Pliny-Bot #633.
export function evaluate(files, limits = DEFAULT_LIMITS, tracked = new Set()) {
  const violations = []
  const add = (rule, file, line, detail) => violations.push({ rule, file, line, detail, fix: FIX[rule] })
  const totals = { sourceCode: 0, trackedCode: 0, testCode: 0, comments: 0, testLines: 0, cases: 0 }
  const commentsByFile = new Map()

  for (const file of files) {
    const kind = kindOf(file.path)
    if (!kind || isGenerated(file.after)) continue
    const kinds = lineKinds(file.after)
    for (const n of file.added) {
      const k = kinds[n - 1]
      if (k === 'comment') {
        totals.comments += 1
        commentsByFile.set(file.path, (commentsByFile.get(file.path) ?? 0) + 1)
      } else if (k === 'code') {
        if (kind !== 'source') totals.testCode += 1
        else {
          totals.sourceCode += 1
          if (tracked.has(file.path)) totals.trackedCode += 1
        }
      }
    }

    const findings = slopFindings(file.after)
    for (const f of findings) {
      if (file.added.has(f.line)) add(f.rule, file.path, f.line)
      else if (file.before != null) add('touched-file-slop', file.path, f.line, f.rule)
    }
    for (const block of commentBlocks(file.after)) {
      let touched = false
      for (let n = block.start; n <= block.end && !touched; n++) touched = file.added.has(n)
      if (touched) for (const rule of block.rules) add(rule, file.path, block.start)
    }

    const before = file.before == null ? { codeLines: 0, commentLines: 0 } : countLines(file.before)
    const after = countLines(file.after)
    if (kind === 'source') {
      const density = c => (c.codeLines > 0 ? c.commentLines / c.codeLines : c.commentLines > 0 ? Infinity : 0)
      if (file.before != null && after.commentLines > before.commentLines && density(after) > density(before)) {
        add('touched-file-density', file.path, undefined, `${before.commentLines}/${before.codeLines} -> ${after.commentLines}/${after.codeLines}`)
      }
      continue
    }
    totals.testLines += after.codeLines - before.codeLines
    const statsBefore = file.before == null ? EMPTY_STATS : testStats(file.path, file.before)
    const statsAfter = testStats(file.path, file.after)
    totals.cases += Math.max(0, statsAfter.cases - statsBefore.cases)
    for (const [key, rule] of Object.entries(SUSPICIOUS)) {
      const grew = statsAfter[key] - statsBefore[key]
      if (grew > 0) add(rule, file.path, undefined, `+${grew}`)
    }
  }

  const commentBudget = Math.max(limits.commentAllowance, Math.floor(limits.commentRatio * (totals.sourceCode + totals.testCode)))
  const testedCode = totals.sourceCode + totals.trackedCode
  const testBudget = Math.max(limits.testAllowance, Math.floor(limits.testRatio * testedCode))
  const caseBudget = Math.max(limits.caseAllowance, Math.floor((limits.casesPerKloc * testedCode) / 1000))
  if (totals.comments > commentBudget) {
    const where = [...commentsByFile].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${f} (${n})`).join(', ')
    add('comment-budget', undefined, undefined, `${totals.comments} comment lines added, budget ${commentBudget}: ${where}`)
  }
  if (totals.testLines > testBudget) {
    add('test-budget', undefined, undefined, `${totals.testLines} test lines added for ${totals.sourceCode} code lines, budget ${testBudget}`)
  }
  if (totals.cases > caseBudget) {
    add('case-budget', undefined, undefined, `${totals.cases} test cases added for ${totals.sourceCode} code lines, budget ${caseBudget}`)
  }
  return { totals, budgets: { comments: commentBudget, testLines: testBudget, cases: caseBudget }, violations }
}

export function addedLines(unifiedDiff) {
  const added = new Set()
  for (const m of unifiedDiff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1])
    const length = m[2] === undefined ? 1 : Number(m[2])
    for (let n = start; n < start + length; n++) added.add(n)
  }
  return added
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] })
}

function tryGit(root, args) {
  try {
    return git(root, args).trim()
  } catch {
    return null
  }
}

function resolveBase(root, requested) {
  const candidates = requested ? [requested] : ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']
  for (const ref of candidates) {
    const base = tryGit(root, ['merge-base', ref, 'HEAD'])
    if (base) return { ref, base }
  }
  return null
}

const normalize = text => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

export function collect(root, base) {
  const files = []
  const entries = git(root, ['diff', '--name-status', '-M', '-z', base]).split('\0').filter(Boolean)
  for (let i = 0; i < entries.length; ) {
    const status = entries[i]
    const renamed = status.startsWith('R') || status.startsWith('C')
    const from = entries[i + 1]
    const to = renamed ? entries[i + 2] : from
    i += renamed ? 3 : 2
    if (status === 'D' || !kindOf(to)) continue
    const full = path.join(root, to)
    if (!fs.existsSync(full)) continue
    const after = normalize(fs.readFileSync(full, 'utf8'))
    const before = status === 'A' ? null : normalize(git(root, ['show', `${base}:${from}`]))
    const diff = git(root, ['diff', '-U0', '--no-color', '--no-ext-diff', '-M', base, '--', ...new Set([from, to])])
    files.push({ path: to, before, after, added: addedLines(diff) })
  }
  for (const untracked of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
    if (!kindOf(untracked)) continue
    const after = normalize(fs.readFileSync(path.join(root, untracked), 'utf8'))
    const count = after.split('\n').length - (after.endsWith('\n') ? 1 : 0)
    files.push({ path: untracked, before: null, after, added: new Set(Array.from({ length: count }, (_, k) => k + 1)) })
  }
  return files
}

// A subagent checks only the files it owns while others edit the same tree: the budgets then fit its share.
export function scope(files, paths) {
  if (!paths?.length) return files
  const norm = paths.map(p => p.replace(/\\/g, '/').replace(/^\.\//, ''))
  return files.filter(f => norm.some(p => f.path === p || f.path.startsWith(p.endsWith('/') ? p : `${p}/`)))
}

// Paths of the files a complexity gate tracks, from its baseline keyed `path::method`.
export function trackedFiles(root, baseline) {
  try {
    const entries = Object.keys(JSON.parse(fs.readFileSync(path.join(root, baseline), 'utf8')))
    return new Set(entries.map(key => key.split('::')[0]))
  } catch {
    return new Set()
  }
}

function readLimits(root) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, '.opencode', 'harness.json'), 'utf8'))
    return { ...DEFAULT_LIMITS, ...config.codeRules }
  } catch {
    return DEFAULT_LIMITS
  }
}

function report(result, base) {
  const { totals, budgets, violations } = result
  const lines = [
    `check-diff against ${base.ref} (${base.base.slice(0, 7)}): ${violations.length === 0 ? 'clean' : `${violations.length} problem${violations.length === 1 ? '' : 's'}`}`,
    `  code lines added ${totals.sourceCode}, comment lines ${totals.comments}/${budgets.comments}, test lines ${totals.testLines}/${budgets.testLines}, test cases ${totals.cases}/${budgets.cases}`,
  ]
  const byRule = new Map()
  for (const v of violations) byRule.set(v.rule, [...(byRule.get(v.rule) ?? []), v])
  for (const [rule, list] of byRule) {
    lines.push('', `${rule}: ${FIX[rule]}`)
    for (const v of list.slice(0, 50)) {
      const where = v.file ? `${v.file}${v.line ? `:${v.line}` : ''}` : ''
      lines.push(`  ${[where, v.detail].filter(Boolean).join('  ')}`)
    }
    if (list.length > 50) lines.push(`  ... ${list.length - 50} more`)
  }
  return lines.join('\n')
}

function main(argv) {
  const option = name => {
    const i = argv.indexOf(`--${name}`)
    return i === -1 ? undefined : argv[i + 1]
  }
  const root = tryGit(process.cwd(), ['rev-parse', '--show-toplevel'])
  if (!root) {
    console.error('check-diff: not inside a git repository.')
    return 2
  }
  const base = resolveBase(root, option('base') ?? process.env.CHECK_DIFF_BASE)
  if (!base) {
    console.error('check-diff: no base to compare against. Pass --base <ref> or fetch origin.')
    return 2
  }
  const limits = readLimits(root)
  const paths = option('paths')?.split(',').map(p => p.trim()).filter(Boolean)
  const result = evaluate(scope(collect(root, base.base), paths), limits, trackedFiles(root, limits.complexityBaseline))
  console.log(argv.includes('--json') ? JSON.stringify({ base, ...result }, null, 2) : report(result, base))
  return result.violations.length === 0 ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2))
