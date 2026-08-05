#!/usr/bin/env node
/**
 * Fail on product-facing GenOffice / Genspark trademark identifiers.
 * Attribution in NOTICE / historical README mentions are allowlisted.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const root = process.cwd()
const SKIP_DIRS = new Set(['.git', 'node_modules', 'out', 'dist', 'release', 'fixtures', '.cursor'])
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml',
  '.html', '.css', '.txt', '.svg', '.plist',
])

/** Relative paths that may mention upstream names for legal / history reasons */
const ALLOWLIST_FILES = new Set([
  'NOTICE',
  'README.md',
  'tools/check-no-ee.mjs',
  'tools/check-trademarks.mjs',
  'tools/rebrand-arkoffice.mjs',
])

const BANNED = [
  { id: '@genoffice', re: /@genoffice\b/ },
  { id: 'GENOFFICE_', re: /GENOFFICE_/ },
  { id: 'com.genoffice', re: /com\.genoffice\b/ },
  { id: 'GenOffice', re: /\bGenOffice\b/ },
  { id: 'genoffice (bare)', re: /(?<!@|\/|derived from |genspark-ai\/)\bgenoffice\b/i },
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

const hits = []
for (const file of walk(root)) {
  const rel = relative(root, file).replace(/\\/g, '/')
  if (ALLOWLIST_FILES.has(rel)) continue
  if (rel === 'package-lock.json') continue
  const ext = extname(file).toLowerCase()
  if (!TEXT_EXT.has(ext) && !rel.endsWith('CODEOWNERS')) continue

  const text = readFileSync(file, 'utf8')
  for (const ban of BANNED) {
    if (ban.re.test(text)) {
      // GenOffice Enterprise License phrase is OK in docs about exclusion
      if (ban.id === 'GenOffice' && /GenOffice Enterprise License/.test(text) && !/\bGenOffice\b(?! Enterprise License)/.test(text.replace(/GenOffice Enterprise License/g, ''))) {
        continue
      }
      hits.push({ file: rel, rule: ban.id })
    }
  }
}

if (hits.length) {
  console.error('Trademark scan failed:')
  for (const h of hits.slice(0, 50)) {
    console.error(`  [${h.rule}] ${h.file}`)
  }
  if (hits.length > 50) console.error(`  … and ${hits.length - 50} more`)
  process.exit(1)
}

console.log('OK: no product-facing GenOffice identifiers outside allowlist.')
