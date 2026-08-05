/**
 * Bundled llama-server lifecycle for local runtime mode (L3).
 * Remote mode never starts this process.
 */
import { spawn, type ChildProcess, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { pickGgufModel, type AiSettings, type LlmBackendId } from '@arkoffice/ai-provider'
import {
  LLM_BINARY_NAMES,
  resolveBackendTryOrder,
  resolveListenHost,
  type LlmBinaryKind,
} from './llm-backend'
import {
  absolutePathForModelId,
  getModelsDirStatus,
  resolveModelsDir,
} from './llm-models'
import {
  createLlmQueueProxy,
  resolveUpstreamPort,
  type LlmQueueProxy,
  type LlmQueueStatus,
} from './llm-queue-proxy'

export type { LlmBinaryKind }
export type { LlmQueueStatus }

export type LlmRuntimeState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'error'
  | 'skipped-remote'
  | 'skipped-no-binary'
  | 'skipped-no-model'

export interface LlmRuntimeStatus {
  state: LlmRuntimeState
  runtimeMode: AiSettings['runtimeMode']
  backendPreference: LlmBackendId
  backendEffective: LlmBinaryKind | null
  detectedBackend: LlmBinaryKind
  port: number
  /** llama-server loopback port behind the queue proxy */
  upstreamPort: number | null
  host: string
  modelPath: string | null
  binaryPath: string | null
  pid: number | null
  message: string
  lastError: string | null
  availableBinaries: LlmBinaryKind[]
  queue: LlmQueueStatus | null
}

const MAX_RESTARTS = 3
const HEALTH_TIMEOUT_MS = 90_000
const HEALTH_POLL_MS = 500

let child: ChildProcess | null = null
let proxy: LlmQueueProxy | null = null
let status: LlmRuntimeStatus | null = null
let restartCount = 0
let ensureChain: Promise<LlmRuntimeStatus> | null = null

function emptyStatus(): LlmRuntimeStatus {
  return {
    state: 'stopped',
    runtimeMode: 'local',
    backendPreference: 'auto',
    backendEffective: null,
    detectedBackend: detectPreferredBackend(),
    port: 8080,
    upstreamPort: null,
    host: '127.0.0.1',
    modelPath: null,
    binaryPath: null,
    pid: null,
    message: '',
    lastError: null,
    availableBinaries: listAvailableBinaries(),
    queue: null,
  }
}

/** Vendor dir: packaged `resources/llm`, else `apps/shell/vendor/llm`, else env. */
export function resolveLlmVendorDir(): string {
  const env = process.env.ARKOFFICE_LLM_DIR?.trim()
  if (env) return env
  if (app.isPackaged) return join(process.resourcesPath, 'llm')
  return join(app.getAppPath(), 'vendor', 'llm')
}

export function listAvailableBinaries(vendorDir = resolveLlmVendorDir()): LlmBinaryKind[] {
  return (Object.keys(LLM_BINARY_NAMES) as LlmBinaryKind[]).filter((kind) =>
    existsSync(join(vendorDir, LLM_BINARY_NAMES[kind])),
  )
}

export function binaryPathFor(
  kind: LlmBinaryKind,
  vendorDir = resolveLlmVendorDir(),
): string | null {
  const p = join(vendorDir, LLM_BINARY_NAMES[kind])
  return existsSync(p) ? p : null
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync(cmd, ['--version'], { stdio: 'ignore', windowsHide: true, timeout: 3000 })
    return true
  } catch {
    try {
      execFileSync(cmd, ['-h'], { stdio: 'ignore', windowsHide: true, timeout: 3000 })
      return true
    } catch {
      return false
    }
  }
}

/** Heuristic GPU capability probe (Windows-focused for this phase). */
export function detectPreferredBackend(): LlmBinaryKind {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const nvcuda = join(systemRoot, 'System32', 'nvcuda.dll')
    if (existsSync(nvcuda) || commandExists('nvidia-smi')) return 'cuda'
    const vulkan = join(systemRoot, 'System32', 'vulkan-1.dll')
    if (existsSync(vulkan)) return 'vulkan'
  }
  return 'cpu'
}

function listenHost(settings: AiSettings): string {
  return resolveListenHost({ listenLan: settings.listenLan })
}

function buildArgs(
  modelPath: string,
  host: string,
  port: number,
  backend: LlmBinaryKind,
): string[] {
  const ngl = backend === 'cpu' ? '0' : '99'
  return [
    '-m',
    modelPath,
    '--host',
    host,
    '--port',
    String(port),
    '-np',
    '1',
    '-ngl',
    ngl,
  ]
}

async function waitForHealthy(port: number, signal: AbortSignal): Promise<boolean> {
  const url = `http://127.0.0.1:${port}/v1/models`
  const started = Date.now()
  while (Date.now() - started < HEALTH_TIMEOUT_MS) {
    if (signal.aborted) return false
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS))
  }
  return false
}

export function getLlmRuntimeStatus(): LlmRuntimeStatus {
  const base = status ?? emptyStatus()
  return {
    ...base,
    detectedBackend: detectPreferredBackend(),
    availableBinaries: listAvailableBinaries(),
    pid: child?.pid ?? null,
    queue: proxy ? proxy.getStatus() : null,
    upstreamPort: proxy?.upstreamPort ?? base.upstreamPort,
  }
}

async function stopProxy(): Promise<void> {
  const p = proxy
  proxy = null
  if (p) await p.stop()
}

export async function stopLlmRuntime(reason = 'stopped'): Promise<void> {
  await stopProxy()
  const proc = child
  child = null
  if (!proc) {
    if (status && (status.state === 'running' || status.state === 'starting')) {
      status = { ...status, state: 'stopped', pid: null, message: reason, queue: null, upstreamPort: null }
    }
    return
  }
  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    proc.once('exit', done)
    try {
      proc.kill()
    } catch {
      /* already dead */
    }
    setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      done()
    }, 3000)
  })
  status = {
    ...getLlmRuntimeStatus(),
    state: 'stopped',
    pid: null,
    message: reason,
    lastError: null,
    queue: null,
    upstreamPort: null,
  }
}

function spawnServer(binary: string, args: string[]): ChildProcess {
  const proc = spawn(binary, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  proc.stdout?.on('data', () => {
    /* drain */
  })
  proc.stderr?.on('data', () => {
    /* drain */
  })
  proc.on('exit', (code, signal) => {
    if (child === proc) {
      child = null
      status = {
        ...getLlmRuntimeStatus(),
        state: 'error',
        pid: null,
        lastError: `llama-server exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`,
        message: 'llama-server が終了しました',
      }
    }
  })
  return proc
}

/**
 * Align runtime with settings: start for local, stop for remote.
 * Safe to call repeatedly; concurrent calls share one promise.
 */
export function ensureLlmRuntime(settings: AiSettings): Promise<LlmRuntimeStatus> {
  if (!ensureChain) {
    ensureChain = ensureLlmRuntimeInner(settings).finally(() => {
      ensureChain = null
    })
  }
  return ensureChain
}

async function ensureLlmRuntimeInner(settings: AiSettings): Promise<LlmRuntimeStatus> {
  const detectedBackend = detectPreferredBackend()
  const availableBinaries = listAvailableBinaries()
  const host = listenHost(settings)
  const port = settings.port || 8080
  const upstreamPort = resolveUpstreamPort(port)
  const prevRunning = status?.state === 'running' ? { ...status } : null

  if (settings.runtimeMode === 'remote') {
    await stopLlmRuntime('remote-mode')
    status = {
      ...emptyStatus(),
      runtimeMode: 'remote',
      backendPreference: settings.backend,
      detectedBackend,
      availableBinaries,
      port,
      host,
      state: 'skipped-remote',
      message: 'リモートモードのため同梱 llama-server は起動しません',
    }
    return getLlmRuntimeStatus()
  }

  if (process.platform !== 'win32') {
    status = {
      ...emptyStatus(),
      runtimeMode: 'local',
      backendPreference: settings.backend,
      detectedBackend,
      availableBinaries,
      port,
      host,
      state: 'skipped-no-binary',
      message: 'このフェーズの同梱ランタイムは Windows x64 のみです',
      lastError: 'unsupported-platform',
    }
    return getLlmRuntimeStatus()
  }

  const modelsStatus = getModelsDirStatus(settings.modelsDir)
  const picked = pickGgufModel(modelsStatus.models, settings.selectedModelFile)
  if (!picked.id) {
    await stopLlmRuntime('no-model')
    status = {
      ...emptyStatus(),
      runtimeMode: 'local',
      backendPreference: settings.backend,
      detectedBackend,
      availableBinaries,
      port,
      host,
      state: 'skipped-no-model',
      message: 'GGUF モデルが見つかりません。モデルフォルダに .gguf を配置してください',
      lastError: 'no-model',
    }
    return getLlmRuntimeStatus()
  }

  const modelPath = absolutePathForModelId(resolveModelsDir(settings.modelsDir), picked.id)
  if (!modelPath || !existsSync(modelPath)) {
    await stopLlmRuntime('no-model')
    status = {
      ...emptyStatus(),
      runtimeMode: 'local',
      backendPreference: settings.backend,
      detectedBackend,
      availableBinaries,
      port,
      host,
      modelPath,
      state: 'skipped-no-model',
      message: '選択中の GGUF ファイルを開けません',
      lastError: 'model-missing',
    }
    return getLlmRuntimeStatus()
  }

  const tryOrder = resolveBackendTryOrder(settings.backend, availableBinaries, detectedBackend)
  if (tryOrder.length === 0) {
    await stopLlmRuntime('no-binary')
    status = {
      ...emptyStatus(),
      runtimeMode: 'local',
      backendPreference: settings.backend,
      detectedBackend,
      availableBinaries,
      port,
      host,
      modelPath,
      state: 'skipped-no-binary',
      message:
        'llama-server バイナリがありません。apps/shell/vendor/llm に配置するかリリース同梱を確認してください',
      lastError: 'no-binary',
    }
    return getLlmRuntimeStatus()
  }

  if (
    child &&
    proxy &&
    prevRunning &&
    prevRunning.modelPath === modelPath &&
    prevRunning.port === port &&
    prevRunning.host === host &&
    prevRunning.upstreamPort === upstreamPort &&
    prevRunning.backendEffective &&
    tryOrder.includes(prevRunning.backendEffective)
  ) {
    status = {
      ...prevRunning,
      backendPreference: settings.backend,
      detectedBackend,
      availableBinaries,
      runtimeMode: 'local',
    }
    return getLlmRuntimeStatus()
  }

  await stopLlmRuntime('restart')

  let lastErr: string | null = null

  for (const backend of tryOrder) {
    const binary = binaryPathFor(backend)
    if (!binary) continue
    status = {
      ...emptyStatus(),
      runtimeMode: 'local',
      backendPreference: settings.backend,
      detectedBackend,
      availableBinaries,
      state: 'starting',
      backendEffective: backend,
      binaryPath: binary,
      modelPath,
      host,
      port,
      upstreamPort,
      message: `llama-server (${backend}) を起動しています…`,
    }

    // llama always on loopback; public host/port is the queue proxy
    const args = buildArgs(modelPath, '127.0.0.1', upstreamPort, backend)
    const proc = spawnServer(binary, args)
    child = proc

    const abort = new AbortController()
    const healthy = await waitForHealthy(upstreamPort, abort.signal)
    if (!healthy || child !== proc) {
      lastErr = `health-check-failed:${backend}`
      if (child === proc) {
        child = null
        try {
          proc.kill()
        } catch {
          /* ignore */
        }
      }
      if (settings.backend !== 'auto') break
      continue
    }

    try {
      const nextProxy = createLlmQueueProxy({
        listenHost: host,
        listenPort: port,
        upstreamHost: '127.0.0.1',
        upstreamPort,
      })
      await nextProxy.start()
      proxy = nextProxy
    } catch (err) {
      lastErr = `proxy-listen-failed:${err instanceof Error ? err.message : String(err)}`
      if (child === proc) {
        child = null
        try {
          proc.kill()
        } catch {
          /* ignore */
        }
      }
      if (settings.backend !== 'auto') break
      continue
    }

    const proxyHealthy = await waitForHealthy(port, abort.signal)
    if (proxyHealthy && child === proc && proxy) {
      restartCount = 0
      status = {
        ...getLlmRuntimeStatus(),
        state: 'running',
        backendEffective: backend,
        binaryPath: binary,
        modelPath,
        host,
        port,
        upstreamPort,
        pid: proc.pid ?? null,
        message: `llama-server (${backend}) + 待ち行列プロキシが起動しました`,
        lastError: null,
      }
      return getLlmRuntimeStatus()
    }

    lastErr = `proxy-health-check-failed:${backend}`
    await stopProxy()
    if (child === proc) {
      child = null
      try {
        proc.kill()
      } catch {
        /* ignore */
      }
    }
    if (settings.backend !== 'auto') break
  }

  restartCount += 1
  status = {
    ...emptyStatus(),
    runtimeMode: 'local',
    backendPreference: settings.backend,
    detectedBackend,
    availableBinaries,
    state: 'error',
    modelPath,
    host,
    port,
    upstreamPort,
    message:
      restartCount >= MAX_RESTARTS
        ? 'llama-server の起動に繰り返し失敗しました'
        : 'llama-server を起動できませんでした',
    lastError: lastErr,
  }
  return getLlmRuntimeStatus()
}

/** Soft restart used after settings save. */
export async function refreshLlmRuntime(settings: AiSettings): Promise<LlmRuntimeStatus> {
  await stopLlmRuntime('settings-changed')
  return ensureLlmRuntime(settings)
}

export { resolveBackendTryOrder, resolveListenHost, resolveUpstreamPort }
