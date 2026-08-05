import type { AiProviderId, AiProviderMeta, AiSettings, LegacyAiSettings } from './types'

/** Default llama.cpp `llama-server` OpenAI-compatible endpoint */
export const LOCAL_LLM_DEFAULT_BASE_URL = 'http://127.0.0.1:8080/v1'

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
  return { provider: 'local', providers }
}

/**
 * Merge on-disk settings over freshly computed defaults, migrating the
 * pre-provider shape (a single OpenAI-compatible endpoint) into the
 * "custom" provider slot, and migrating removed `genspark` → `local`.
 */
export function resolveAiSettings(
  stored: Partial<AiSettings> & LegacyAiSettings & { provider?: string },
  defaults: AiSettings,
): AiSettings {
  if (!stored.providers) {
    if (stored.apiKey) {
      defaults.providers.custom = {
        apiKey: stored.apiKey,
        model: stored.model ?? '',
        baseUrl: stored.baseUrl ?? 'https://api.openai.com/v1',
      }
    }
    return defaults
  }

  const providers = { ...defaults.providers, ...stored.providers } as AiSettings['providers']
  // Drop legacy genspark slot if present in older settings files
  delete (providers as Record<string, unknown>).genspark

  let provider = (stored.provider as AiProviderId | 'genspark' | undefined) ?? defaults.provider
  if (provider === 'genspark' || !(provider in providers)) {
    provider = 'local'
  }

  return { provider, providers }
}
