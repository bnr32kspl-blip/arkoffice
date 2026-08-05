import { describe, expect, it } from 'vitest'
import {
  AI_PROVIDERS,
  LOCAL_LLM_DEFAULT_BASE_URL,
  applyRuntimeModeToSettings,
  defaultAiSettings,
  localBaseUrlForPort,
  normalizeRemoteBaseUrl,
  resolveAiSettings,
} from '../src/providers'

describe('defaultAiSettings', () => {
  it('defaults to the local llama.cpp provider', () => {
    const settings = defaultAiSettings()
    expect(settings.provider).toBe('local')
    expect(settings.runtimeMode).toBe('local')
    expect(settings.providers.local.baseUrl).toBe(LOCAL_LLM_DEFAULT_BASE_URL)
    expect(settings.remoteBaseUrl).toBe('')
    expect(settings.listenLan).toBe(false)
    expect(settings.backend).toBe('auto')
    expect(settings.port).toBe(8080)
    expect(settings.llmRuntimeConfigured).toBe(false)
    for (const meta of AI_PROVIDERS) {
      expect(settings.providers[meta.id].apiKey).toBe('')
      expect(settings.providers[meta.id].model).toBe(meta.defaultModel)
    }
    expect(settings.providers.custom.baseUrl).toBe('')
    expect(settings.providers.anthropic.baseUrl).toBeUndefined()
  })

  it('applies caller-supplied default keys only to the listed providers', () => {
    const settings = defaultAiSettings({ anthropic: 'sk-ant-preset' })
    expect(settings.providers.anthropic.apiKey).toBe('sk-ant-preset')
    expect(settings.providers.gemini.apiKey).toBe('')
  })
})

describe('normalizeRemoteBaseUrl', () => {
  it('accepts http/https and ensures /v1', () => {
    expect(normalizeRemoteBaseUrl('http://192.168.10.20:8080')).toBe(
      'http://192.168.10.20:8080/v1',
    )
    expect(normalizeRemoteBaseUrl('http://192.168.10.20:8080/v1')).toBe(
      'http://192.168.10.20:8080/v1',
    )
    expect(normalizeRemoteBaseUrl('https://llm.example.local/v1/')).toBe(
      'https://llm.example.local/v1',
    )
  })

  it('rejects non-http schemes and empty input', () => {
    expect(normalizeRemoteBaseUrl('')).toBeNull()
    expect(normalizeRemoteBaseUrl('ftp://host/v1')).toBeNull()
    expect(normalizeRemoteBaseUrl('not a url')).toBeNull()
  })
})

describe('applyRuntimeModeToSettings', () => {
  it('forces loopback Base URL in local mode', () => {
    const base = defaultAiSettings()
    const applied = applyRuntimeModeToSettings({
      ...base,
      runtimeMode: 'local',
      port: 8090,
      remoteBaseUrl: 'http://192.168.1.5:8080/v1',
      providers: {
        ...base.providers,
        local: { ...base.providers.local, baseUrl: 'http://old.example/v1' },
      },
    })
    expect(applied.providers.local.baseUrl).toBe(localBaseUrlForPort(8090))
  })

  it('copies normalized remoteBaseUrl into providers.local.baseUrl', () => {
    const base = defaultAiSettings()
    const applied = applyRuntimeModeToSettings({
      ...base,
      runtimeMode: 'remote',
      remoteBaseUrl: 'http://10.0.0.8:8080',
    })
    expect(applied.remoteBaseUrl).toBe('http://10.0.0.8:8080/v1')
    expect(applied.providers.local.baseUrl).toBe('http://10.0.0.8:8080/v1')
  })
})

describe('resolveAiSettings', () => {
  it('returns fresh defaults when nothing is stored', () => {
    const defaults = defaultAiSettings({ anthropic: 'sk-ant-preset' })
    expect(resolveAiSettings({}, defaults)).toEqual(defaults)
  })

  it('migrates the pre-provider single-endpoint shape into the custom provider', () => {
    const defaults = defaultAiSettings()
    const resolved = resolveAiSettings(
      { apiKey: 'legacy-key', model: 'legacy-model', baseUrl: 'https://legacy.example.com/v1' },
      defaults,
    )
    expect(resolved.providers.custom).toEqual({
      apiKey: 'legacy-key',
      model: 'legacy-model',
      baseUrl: 'https://legacy.example.com/v1',
    })
    expect(resolved.providers.anthropic).toEqual(defaults.providers.anthropic)
    expect(resolved.runtimeMode).toBe('local')
  })

  it('defaults the legacy base URL to the OpenAI endpoint when omitted', () => {
    const resolved = resolveAiSettings({ apiKey: 'legacy-key' }, defaultAiSettings())
    expect(resolved.providers.custom.baseUrl).toBe('https://api.openai.com/v1')
  })

  it('merges stored multi-provider settings over the defaults, provider by provider', () => {
    const defaults = defaultAiSettings({ anthropic: 'preset-key' })
    const resolved = resolveAiSettings(
      {
        provider: 'gemini',
        providers: {
          gemini: { apiKey: 'stored-gemini-key', model: 'gemini-2.5-pro' },
        } as never,
      },
      defaults,
    )
    expect(resolved.provider).toBe('gemini')
    expect(resolved.providers.gemini).toEqual({
      apiKey: 'stored-gemini-key',
      model: 'gemini-2.5-pro',
    })
    expect(resolved.providers.anthropic.apiKey).toBe('preset-key')
    expect(resolved.runtimeMode).toBe('local')
  })

  it('migrates legacy arkoffice provider selection to local', () => {
    const defaults = defaultAiSettings()
    const resolved = resolveAiSettings(
      {
        provider: 'arkoffice' as never,
        providers: {
          arkoffice: { apiKey: '', model: 'claude-opus-4-7' },
        } as never,
      },
      defaults,
    )
    expect(resolved.provider).toBe('local')
    expect((resolved.providers as Record<string, unknown>).arkoffice).toBeUndefined()
  })

  it('keeps remote mode and syncs Base URL from remoteBaseUrl', () => {
    const defaults = defaultAiSettings()
    const resolved = resolveAiSettings(
      {
        provider: 'local',
        runtimeMode: 'remote',
        remoteBaseUrl: 'http://192.168.10.20:8080/v1',
        providers: {
          local: { apiKey: '', model: 'm', baseUrl: 'http://127.0.0.1:8080/v1' },
        } as never,
      },
      defaults,
    )
    expect(resolved.runtimeMode).toBe('remote')
    expect(resolved.providers.local.baseUrl).toBe('http://192.168.10.20:8080/v1')
  })

  it('infers remoteBaseUrl from a non-loopback local baseUrl when remote', () => {
    const defaults = defaultAiSettings()
    const resolved = resolveAiSettings(
      {
        provider: 'local',
        runtimeMode: 'remote',
        providers: {
          local: { apiKey: '', model: 'm', baseUrl: 'http://10.1.2.3:8080/v1' },
        } as never,
      },
      defaults,
    )
    expect(resolved.remoteBaseUrl).toBe('http://10.1.2.3:8080/v1')
    expect(resolved.providers.local.baseUrl).toBe('http://10.1.2.3:8080/v1')
  })
})
