#!/usr/bin/env node
/**
 * Fail on product-facing GenOffice / Genspark trademark identifiers.
 * Attribution in NOTICE / historical README mentions are allowlisted.
 * Technical npm package `@genspark/cli` and its runtime paths are allowlisted.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const root = process.cwd()
const SKIP_DIRS = new Set(['.git', 'node_modules', 'out', 'dist', 'release', 'fixtures', '.cursor', 'vendor'])
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml',
  '.html', '.css', '.txt', '.svg', '.plist',
])

/** Relative paths that may mention upstream names for legal / history / tooling reasons */
const ALLOWLIST_FILES = new Set([
  'NOTICE',
  'README.md',
  'CONTRIBUTING.md',
  'docs/network-allowlist.md',
  'tools/check-no-ee.mjs',
  'tools/check-trademarks.mjs',
  'tools/check-airgap-defaults.mjs',
  'tools/gen-third-party-notices.mjs',
  'tools/scrub-genspark.py',
  'tools/scrub-genspark-pass2.py',
  'tools/rebrand-arkoffice.mjs',
  'packages/ai-search/package.json',
  'packages/ai-search/src/gsk.ts',
  'packages/ai-search/tests/gsk.test.ts',
  'packages/ai-search/tests/gsk-login.test.ts',
  'packages/ai-provider/src/stream.ts',
  'packages/ai-provider/tests/stream.test.ts',
  'packages/ai-provider/tests/chat.test.ts',
  'packages/ai-provider/src/providers.ts',
  'packages/ai-provider/tests/providers.test.ts',
  'apps/shell/electron-builder.cjs',
])

const BANNED = [
  { id: '@genoffice', re: /@genoffice\b/ },
  { id: 'GENOFFICE_', re: /GENOFFICE_/ },
  { id: 'com.genoffice', re: /com\.genoffice\b/ },
  { id: 'GenOffice', re: /\bGenOffice\b/ },
  { id: 'genoffice (bare)', re: /(?<!@|\/|derived from |genspark-ai\/)\bgenoffice\b/i },
  { id: 'Genspark', re: /\bGenspark\b/ },
  { id: 'GenSpark', re: /\bGenSpark\b/ },
  { id: 'genspark (bare)', re: /(?<!@|\/|\.|sspark\.)\bgenspark\b/i },
  { id: 'GenTeam', re: /\bGenTeam\b/ },
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
  if (rel.endsWith('THIRD-PARTY-NOTICES.txt')) continue
  const ext = extname(file).toLowerCase()
  if (!TEXT_EXT.has(ext) && !rel.endsWith('CODEOWNERS')) continue

  const text = readFileSync(file, 'utf8')
  for (const ban of BANNED) {
    if (!ban.re.test(text)) continue
    // GenOffice Enterprise License phrase is OK in docs about exclusion
    if (
      ban.id === 'GenOffice' &&
      /GenOffice Enterprise License/.test(text) &&
      !/\bGenOffice\b(?! Enterprise License)/.test(text.replace(/GenOffice Enterprise License/g, ''))
    ) {
      continue
    }
    hits.push({ file: rel, rule: ban.id })
  }
}

if (hits.length) {
  console.error('Trademark scan failed:')
  for (const h of hits.slice(0, 80)) {
    console.error(`  [${h.rule}] ${h.file}`)
  }
  if (hits.length > 80) console.error(`  … and ${hits.length - 80} more`)
  process.exit(1)
}

console.log('OK: no product-facing GenOffice/Genspark identifiers outside allowlist.')
