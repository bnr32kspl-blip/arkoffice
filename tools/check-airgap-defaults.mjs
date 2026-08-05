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
if (!/provider: 'local'/.test(providersSrc) || !providersSrc.includes('runtimeMode: \'local\'')) {
  fail("defaultAiSettings must default to provider/runtimeMode 'local'")
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
  'docs/local-llm-runtime.md',
  'docs/examples/ai-settings.local.example.json',
  'docs/examples/ai-settings.remote.example.json',
  'docs/examples/ai-settings.listen-lan.example.json',
  'docs/examples/update-preferences.disabled.json',
  'docs/examples/README.md',
  'apps/shell/vendor/llm/README.md',
  'apps/shell/electron-builder.cjs',
]) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`)
  else ok(`present ${rel}`)
}

// 6) Example preferences keep update disabled
const pref = JSON.parse(read('docs/examples/update-preferences.disabled.json'))
if (pref.enabled !== false) fail('update-preferences example must set enabled:false')
else ok('update-preferences example is disabled')

// 7) Local LLM packaging + runtime invariants (source-level)
const builderSrc = read('apps/shell/electron-builder.cjs')
if (!builderSrc.includes('optionalLlmResources') || !builderSrc.includes("to: 'llm'")) {
  fail('electron-builder.cjs must optionally bundle vendor/llm → resources/llm')
} else {
  ok('electron-builder optionally bundles vendor/llm')
}

const runtimeSrc = read('apps/shell/src/main/llm-runtime.ts')
if (!runtimeSrc.includes("'-np'") || !runtimeSrc.includes("'1'")) {
  fail('llm-runtime must start llama-server with -np 1')
} else {
  ok('llm-runtime uses -np 1')
}
if (!runtimeSrc.includes('createLlmQueueProxy') || !runtimeSrc.includes('resolveUpstreamPort')) {
  fail('llm-runtime must start the queue proxy in front of llama-server')
} else {
  ok('llm-runtime wires queue proxy')
}

const backendSrc = read('apps/shell/src/main/llm-backend.ts')
if (
  !backendSrc.includes("LLM_LOOPBACK_HOST = '127.0.0.1'") ||
  !backendSrc.includes("LLM_LAN_BIND_HOST = '0.0.0.0'") ||
  !backendSrc.includes('resolveListenHost')
) {
  fail('llm-backend must default to loopback and allow 0.0.0.0 on listenLan')
} else {
  ok('llm listen host defaults to loopback with LAN opt-in')
}

const watchdogSrc = read('packages/ai-provider/src/watchdog.ts')
if (
  !watchdogSrc.includes('AI_CONNECT_TIMEOUT_MS = 60_000') ||
  !watchdogSrc.includes('AI_IDLE_TIMEOUT_MS = 60_000') ||
  !watchdogSrc.includes('AI_CHAT_RESPONSE_TIMEOUT_MS = 180_000')
) {
  fail('AI timeouts must remain 60s connect / 60s idle / 180s chat (AC-10)')
} else {
  ok('AI timeouts unchanged (AC-10)')
}

const checklist = read('docs/verification-checklist.md')
for (const ac of ['AC-1', 'AC-6', 'AC-7', 'AC-11']) {
  if (!checklist.includes(ac)) fail(`verification-checklist.md must cover ${ac}`)
}
ok('verification-checklist covers local LLM acceptance IDs')

if (failed) {
  console.error('\nAir-gap defaults check failed.')
  process.exit(1)
}

console.log('\nOK: air-gap shipping defaults look correct.')
