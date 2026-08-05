#!/usr/bin/env node
/**
 * Verify ArkOffice closed-network shipping defaults in source.
 * Does not require a display or a running Electron app.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = false

function fail(msg) {
  console.error(`ERROR: ${msg}`)
  failed = true
}

function ok(msg) {
  console.log(`OK: ${msg}`)
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

// 1) ee/ and trademarks gates
for (const script of ['tools/check-no-ee.mjs', 'tools/check-trademarks.mjs']) {
  const r = spawnSync(process.execPath, [join(root, script)], {
    cwd: root,
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    fail(`${script} failed\n${r.stdout || ''}${r.stderr || ''}`)
  } else {
    ok(script)
  }
}

// 2) Default AI provider is local with localhost base URL
const providersSrc = read('packages/ai-provider/src/providers.ts')
if (!/return \{ provider: 'local', providers \}/.test(providersSrc)) {
  fail("defaultAiSettings must return provider: 'local'")
} else {
  ok("default AI provider is 'local'")
}
if (!providersSrc.includes("LOCAL_LLM_DEFAULT_BASE_URL = 'http://127.0.0.1:8080/v1'")) {
  fail('LOCAL_LLM_DEFAULT_BASE_URL must point at 127.0.0.1:8080/v1')
} else {
  ok('local LLM default base URL is loopback')
}
if (/id: 'genspark'/.test(providersSrc)) {
  fail('genspark must not appear in AI_PROVIDERS')
} else {
  ok('genspark provider absent from AI_PROVIDERS')
}

// 3) Web search disabled unless explicitly enabled
const searchSrc = read('packages/ai-search/src/index.ts')
if (!/ARKOFFICE_ALLOW_WEB_SEARCH === '1'/.test(searchSrc)) {
  fail('web search must gate on ARKOFFICE_ALLOW_WEB_SEARCH=1')
} else {
  ok('web search requires ARKOFFICE_ALLOW_WEB_SEARCH=1')
}

// 4) Auto-update opt-in
for (const rel of ['apps/shell/src/main/updater.ts', 'apps/docs/src/main/updater.ts']) {
  const src = read(rel)
  if (!src.includes('isAutoUpdateEnabled') || !src.includes('ARKOFFICE_AUTO_UPDATE')) {
    fail(`${rel} must gate on isAutoUpdateEnabled / ARKOFFICE_AUTO_UPDATE`)
  } else if (!/if \(!isAutoUpdateEnabled\(\)\)/.test(src)) {
    fail(`${rel} must return early when auto-update is disabled`)
  } else {
    ok(`${rel} auto-update is opt-in`)
  }
}

// 5) Ops docs present
for (const rel of [
  'docs/air-gapped-deployment.md',
  'docs/network-allowlist.md',
  'docs/verification-checklist.md',
  'docs/examples/ai-settings.local.example.json',
  'docs/examples/update-preferences.disabled.json',
]) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`)
  else ok(`present ${rel}`)
}

// 6) Example preferences keep update disabled
const pref = JSON.parse(read('docs/examples/update-preferences.disabled.json'))
if (pref.enabled !== false) fail('update-preferences example must set enabled:false')
else ok('update-preferences example is disabled')

if (failed) {
  console.error('\nAir-gap defaults check failed.')
  process.exit(1)
}

console.log('\nOK: air-gap shipping defaults look correct.')
