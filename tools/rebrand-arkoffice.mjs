#!/usr/bin/env node
/**
 * Phase 2 rebrand: ArkOffice → ArkOffice (product identifiers).
 * Keeps intentional upstream attribution phrases in NOTICE/README history.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const root = process.cwd()

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'out',
  'dist',
  'release',
  'fixtures',
  '.cursor',
])

const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.rs',
  '.plist',
  '.html',
  '.css',
  '.txt',
  '.svg',
])

/** @type {Array<[RegExp, string]>} */
const REPLACEMENTS = [
  [/@arkoffice\b/g, '@arkoffice'],
  [/ARKOFFICE_/g, 'ARKOFFICE_'],
  [/com\.arkoffice\b/g, 'com.arkoffice'],
  [/ArkOffice/g, 'ArkOffice'],
  // bare package / path identifiers (after scoped & ArkOffice replacements)
  [/\bgenoffice\b/g, 'arkoffice'],
]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function transform(content, rel) {
  // NOTICE: keep Mainfunc attribution, rename product line carefully
  if (rel.replace(/\\/g, '/') === 'NOTICE') {
    return content
      .replace(/^ArkOffice\r?\n/, 'ArkOffice (derived from GenOffice)\n')
      .replace(
        /This product includes software developed at Mainfunc, Inc\./,
        'This product includes software originally developed as ArkOffice at Mainfunc, Inc.',
      )
  }

  // README: only replace product identifiers outside the "経緯" historical narrative
  // Safer: do scoped/env replacements only, leave ArkOffice historical mentions
  if (rel.replace(/\\/g, '/') === 'README.md') {
    let next = content
    next = next.replace(/@arkoffice\b/g, '@arkoffice')
    next = next.replace(/ARKOFFICE_/g, 'ARKOFFICE_')
    next = next.replace(/com\.arkoffice\b/g, 'com.arkoffice')
    // Update phase table / status lines that say ArkOffice as OUR product — none expected
    // Update npm scope line already uses @arkoffice
    return next
  }

  // check-no-ee and CONTRIBUTING mentions of upstream ee / ArkOffice Enterprise — keep "ArkOffice Enterprise"
  if (rel.replace(/\\/g, '/').endsWith('tools/check-no-ee.mjs')) {
    return content
      .replace(/@arkoffice\b/g, '@arkoffice')
      .replace(/\bgenoffice\b/g, 'arkoffice')
  }

  let next = content
  for (const [re, to] of REPLACEMENTS) {
    next = next.replace(re, to)
  }

  // Restore intentional "ArkOffice Enterprise" legal name if mangled
  next = next.replace(/GenOffice Enterprise License/g, 'GenOffice Enterprise License')
  next = next.replace(/derived from GenOffice/g, 'derived from GenOffice')

  return next
}

const files = walk(root).filter((p) => {
  const ext = extname(p).toLowerCase()
  const base = p.split(/[/\\]/).pop()
  if (base === 'package-lock.json') return false
  if (!TEXT_EXT.has(ext) && base !== 'CODEOWNERS') return false
  return true
})

let changed = 0
for (const file of files) {
  const rel = relative(root, file)
  const before = readFileSync(file, 'utf8')
  const after = transform(before, rel)
  if (after !== before) {
    writeFileSync(file, after)
    changed++
    console.log('updated', rel.replace(/\\/g, '/'))
  }
}

console.log(`\nDone. ${changed} files changed.`)
