import type {
  AiProviderId,
  AiProviderMeta,
  AiSettings,
  LegacyAiSettings,
  LlmBackendId,
  LlmRuntimeMode,
} from './types'
import { ggufModelApiId } from './gguf-models'

/** Default llama.cpp `llama-server` OpenAI-compatible endpoint */
export const LOCAL_LLM_DEFAULT_BASE_URL = 'http://127.0.0.1:8080/v1'

export const LOCAL_LLM_DEFAULT_PORT = 8080

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'local',
    label: 'Local (llama.cpp)',
    models: [],
    defaultModel: '',
    keyPlaceholder: 'Optional (often unused for local servers)',
    needsBaseUrl: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4.1-mini',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    models: [
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-opus-4-5-20251101',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5-20250929',
    ],
    defaultModel: 'claude-opus-4-7',
    keyPlaceholder: 'sk-ant-api03-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    models: [],
    defaultModel: '',
    keyPlaceholder: 'API Key',
    needsBaseUrl: true,
  },
]

const RUNTIME_MODES = new Set<LlmRuntimeMode>(['local', 'remote'])
const BACKENDS = new Set<LlmBackendId>(['auto', 'cuda', 'vulkan', 'cpu'])

/**
 * Validate and normalize a remote OpenAI-compatible Base URL.
 * Accepts http/https only; ensures a trailing `/v1` path segment.
 * Returns null when the input is not a usable URL.
 */
export function normalizeRemoteBaseUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname) return null
  let path = parsed.pathname.replace(/\/+$/, '')
  if (!path.endsWith('/v1')) {
    path = path === '' || path === '/' ? '/v1' : `${path}/v1`
  }
  parsed.pathname = path
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

/** Loopback Base URL for the configured local port */
export function localBaseUrlForPort(port: number = LOCAL_LLM_DEFAULT_PORT): string {
  const p = Number.isFinite(port) && port > 0 && port < 65536 ? Math.trunc(port) : LOCAL_LLM_DEFAULT_PORT
  return `http://127.0.0.1:${p}/v1`
}

/**
 * Sync `providers.local.model` from the effective GGUF selection (file stem).
 * Call after pickGgufModel when persisting local-mode settings.
 */
export function applySelectedGgufToSettings(
  settings: AiSettings,
  fileName: string | null,
): AiSettings {
  if (!fileName) return settings
  return {
    ...settings,
    providers: {
      ...settings.providers,
      local: {
        ...settings.providers.local,
        model: ggufModelApiId(fileName),
      },
    },
  }
}

/**
 * Sync `providers.local.baseUrl` from runtimeMode / remoteBaseUrl / port.
 * Does not start or stop processes (L3); URL wiring only.
 */
export function applyRuntimeModeToSettings(settings: AiSettings): AiSettings {
  const next: AiSettings = {
    ...settings,
    providers: {
      ...settings.providers,
      local: { ...settings.providers.local },
    },
  }
  if (next.runtimeMode === 'remote') {
    const normalized = normalizeRemoteBaseUrl(next.remoteBaseUrl)
    if (normalized) {
      next.remoteBaseUrl = normalized
      next.providers.local.baseUrl = normalized
    }
  } else {
    next.runtimeMode = 'local'
    next.providers.local.baseUrl = localBaseUrlForPort(next.port)
  }
  return next
}

function asRuntimeMode(value: unknown, fallback: LlmRuntimeMode): LlmRuntimeMode {
  return typeof value === 'string' && RUNTIME_MODES.has(value as LlmRuntimeMode)
    ? (value as LlmRuntimeMode)
    : fallback
}

function asBackend(value: unknown, fallback: LlmBackendId): LlmBackendId {
  return typeof value === 'string' && BACKENDS.has(value as LlmBackendId)
    ? (value as LlmBackendId)
    : fallback
}

function asPort(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value)
    if (n > 0 && n < 65536) return n
  }
  return fallback
}

/**
 * Fresh settings with every provider's default model and an empty key,
 * except providers listed in `defaultApiKeys`. Callers own that policy; this
 * package has no hardcoded keys. Default provider is local llama.cpp.
 */
export function defaultAiSettings(
  defaultApiKeys?: Partial<Record<AiProviderId, string>>,
): AiSettings {
  const providers = {} as AiSettings['providers']
  for (const meta of AI_PROVIDERS) {
    providers[meta.id] = {
      apiKey: defaultApiKeys?.[meta.id] ?? '',
      model: meta.defaultModel,
      baseUrl: meta.needsBaseUrl
        ? meta.id === 'local'
          ? LOCAL_LLM_DEFAULT_BASE_URL
          : ''
        : undefined,
    }
  }
  return applyRuntimeModeToSettings({
    provider: 'local',
    providers,
    runtimeMode: 'local',
    remoteBaseUrl: '',
    listenLan: false,
    backend: 'auto',
    modelsDir: null,
    selectedModelFile: null,
    port: LOCAL_LLM_DEFAULT_PORT,
    llmRuntimeConfigured: false,
  })
}

type StoredAiSettings = Partial<AiSettings> &
  LegacyAiSettings & {
    provider?: string
    runtimeMode?: string
    backend?: string
  }

/**
 * Merge on-disk settings over freshly computed defaults, migrating the
 * pre-provider shape (a single OpenAI-compatible endpoint) into the
 * "custom" provider slot, and migrating removed `arkoffice` → `local`.
 * Also fills LLM runtime fields and syncs local Base URL to runtimeMode.
 */
export function resolveAiSettings(stored: StoredAiSettings, defaults: AiSettings): AiSettings {
  if (!stored.providers) {
    if (stored.apiKey) {
      defaults.providers.custom = {
        apiKey: stored.apiKey,
        model: stored.model ?? '',
        baseUrl: stored.baseUrl ?? 'https://api.openai.com/v1',
      }
    }
    return applyRuntimeModeToSettings({ ...defaults })
  }

  const providers = { ...defaults.providers, ...stored.providers } as AiSettings['providers']
  // Drop legacy arkoffice slot if present in older settings files
  delete (providers as Record<string, unknown>).arkoffice

  let provider = (stored.provider as AiProviderId | 'arkoffice' | undefined) ?? defaults.provider
  if (provider === 'arkoffice' || !(provider in providers)) {
    provider = 'local'
  }

  const runtimeMode = asRuntimeMode(stored.runtimeMode, defaults.runtimeMode)
  let remoteBaseUrl =
    typeof stored.remoteBaseUrl === 'string' ? stored.remoteBaseUrl : defaults.remoteBaseUrl
  // Migrate: older files may only have providers.local.baseUrl pointing off-loopback
  if (
    runtimeMode === 'remote' &&
    !remoteBaseUrl.trim() &&
    typeof providers.local?.baseUrl === 'string' &&
    providers.local.baseUrl &&
    !providers.local.baseUrl.includes('127.0.0.1') &&
    !providers.local.baseUrl.includes('localhost')
  ) {
    remoteBaseUrl = providers.local.baseUrl
  }

  const merged: AiSettings = {
    provider,
    providers,
    runtimeMode,
    remoteBaseUrl,
    listenLan: typeof stored.listenLan === 'boolean' ? stored.listenLan : defaults.listenLan,
    backend: asBackend(stored.backend, defaults.backend),
    modelsDir:
      stored.modelsDir === null || typeof stored.modelsDir === 'string'
        ? stored.modelsDir
        : defaults.modelsDir,
    selectedModelFile:
      stored.selectedModelFile === null || typeof stored.selectedModelFile === 'string'
        ? stored.selectedModelFile
        : defaults.selectedModelFile,
    port: asPort(stored.port, defaults.port),
    llmRuntimeConfigured:
      typeof stored.llmRuntimeConfigured === 'boolean'
        ? stored.llmRuntimeConfigured
        : defaults.llmRuntimeConfigured,
  }

  return applyRuntimeModeToSettings(merged)
}
