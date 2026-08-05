/** Shared types for GGUF models IPC (shell main ↔ renderer). */

export interface GgufModelListItem {
  id: string
  fileName: string
  absolutePath: string
  sizeBytes: number
}

export interface GgufModelsSnapshot {
  path: string
  exists: boolean
  created: boolean
  error?: string
  models: GgufModelListItem[]
  /** Effective pick given current settings.selectedModelFile */
  selectedId: string | null
  missingSelection: boolean
}

export interface LlmRuntimeStatusDto {
  state: string
  runtimeMode: string
  backendPreference: string
  backendEffective: string | null
  detectedBackend: string
  port: number
  upstreamPort: number | null
  host: string
  modelPath: string | null
  binaryPath: string | null
  pid: number | null
  message: string
  lastError: string | null
  availableBinaries: string[]
  queue: { active: boolean; waiting: number; positionById: Record<string, number> } | null
}
