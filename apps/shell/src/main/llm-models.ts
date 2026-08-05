/**
 * Resolve / ensure / scan the ArkOffice GGUF models directory (main process).
 */
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import {
  normalizeGgufRelativeId,
  sortGgufModelRefs,
  type GgufModelRef,
} from '@arkoffice/ai-provider'

export interface ScannedGgufModel extends GgufModelRef {
  absolutePath: string
  sizeBytes: number
}

export interface ModelsDirStatus {
  path: string
  exists: boolean
  created: boolean
  error?: string
  models: ScannedGgufModel[]
}

function isGgufName(name: string): boolean {
  return name.toLowerCase().endsWith('.gguf')
}

/** Default models directory per platform (overridable via env / settings). */
export function defaultModelsDirPath(): string {
  if (process.platform === 'win32') {
    const programData = process.env.PROGRAMDATA?.trim() || 'C:\\ProgramData'
    return join(programData, 'ArkOffice', 'models')
  }
  // macOS / Linux placeholder until Metal packaging; keep under a shared-ish location
  const home = process.env.HOME?.trim() || process.cwd()
  return join(home, 'Library', 'Application Support', 'ArkOffice', 'models')
}

/**
 * Effective models directory:
 * 1. `ARKOFFICE_MODELS_DIR`
 * 2. settings `modelsDir` when non-empty
 * 3. platform default
 */
export function resolveModelsDir(settingsModelsDir?: string | null): string {
  const env = process.env.ARKOFFICE_MODELS_DIR?.trim()
  if (env) return env
  if (settingsModelsDir && settingsModelsDir.trim()) return settingsModelsDir.trim()
  return defaultModelsDirPath()
}

export function ensureModelsDir(dir: string): { ok: boolean; created: boolean; error?: string } {
  try {
    if (existsSync(dir)) {
      const st = statSync(dir)
      if (!st.isDirectory()) return { ok: false, created: false, error: 'not-a-directory' }
      return { ok: true, created: false }
    }
    mkdirSync(dir, { recursive: true })
    return { ok: true, created: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, created: false, error: message }
  }
}

function pushFile(out: ScannedGgufModel[], modelsRoot: string, abs: string): void {
  try {
    const st = statSync(abs)
    if (!st.isFile()) return
    const rel = normalizeGgufRelativeId(relative(modelsRoot, abs))
    if (!rel || rel.startsWith('..')) return
    out.push({
      id: rel,
      fileName: basename(abs),
      absolutePath: abs,
      sizeBytes: st.size,
    })
  } catch {
    // unreadable entry — skip
  }
}

/** Scan `.gguf` at models root and one subdirectory level. */
export function scanGgufModels(modelsRoot: string): ScannedGgufModel[] {
  const out: ScannedGgufModel[] = []
  if (!existsSync(modelsRoot)) return out

  let entries: string[]
  try {
    entries = readdirSync(modelsRoot)
  } catch {
    return out
  }

  for (const name of entries) {
    const abs = join(modelsRoot, name)
    let st
    try {
      st = statSync(abs)
    } catch {
      continue
    }
    if (st.isFile()) {
      if (isGgufName(name)) pushFile(out, modelsRoot, abs)
      continue
    }
    if (!st.isDirectory()) continue
    let children: string[]
    try {
      children = readdirSync(abs)
    } catch {
      continue
    }
    for (const child of children) {
      if (!isGgufName(child)) continue
      pushFile(out, modelsRoot, join(abs, child))
    }
  }

  return sortGgufModelRefs(out)
}

export function getModelsDirStatus(settingsModelsDir?: string | null): ModelsDirStatus {
  const path = resolveModelsDir(settingsModelsDir)
  const ensured = ensureModelsDir(path)
  if (!ensured.ok) {
    return {
      path,
      exists: existsSync(path),
      created: false,
      error: ensured.error,
      models: [],
    }
  }
  return {
    path,
    exists: true,
    created: ensured.created,
    models: scanGgufModels(path),
  }
}

/** Join models root + relative id safely (rejects `..`). */
export function absolutePathForModelId(modelsRoot: string, id: string): string | null {
  const norm = normalizeGgufRelativeId(id)
  if (!norm || norm.includes('..')) return null
  const abs = join(modelsRoot, ...norm.split('/'))
  const rel = relative(modelsRoot, abs)
  if (rel.startsWith('..') || rel.split(sep).includes('..')) return null
  return abs
}
