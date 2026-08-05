#!/usr/bin/env node
/**
 * Fail if the GenOffice enterprise tree (`ee/`) is present.
 * ArkOffice ships Apache-2.0 core only; ee/ uses a separate license.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const eeDir = join(root, 'ee')

let failed = false

if (existsSync(eeDir)) {
  console.error('ERROR: ee/ directory exists. ArkOffice must not include it.')
  failed = true
}

const tracked = spawnSync(
  'git',
  ['ls-files', '--', 'ee', 'ee/**'],
  { cwd: root, encoding: 'utf8' },
)

if (tracked.status === 0) {
  const files = tracked.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (files.length > 0) {
    console.error('ERROR: tracked files under ee/:')
    for (const file of files) console.error(`  - ${file}`)
    failed = true
  }
} else if (tracked.error) {
  console.warn('WARN: git ls-files unavailable; skipped tracked-file check.')
}

if (failed) {
  console.error(
    '\nRemove ee/ and any Enterprise License materials before continuing.',
  )
  process.exit(1)
}

console.log('OK: ee/ is absent (directory and git index).')
