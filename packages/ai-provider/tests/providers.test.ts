import { describe, expect, it } from 'vitest'
import {
  AI_PROVIDERS,
  LOCAL_LLM_DEFAULT_BASE_URL,
  defaultAiSettings,
  resolveAiSettings,
} from '../src/providers'

describe('defaultAiSettings', () => {
  it('defaults to the local llama.cpp provider', () => {
    const settings = defaultAiSettings()
    expect(settings.provider).toBe('local')
    expect(settings.providers.local.baseUrl).toBe(LOCAL_LLM_DEFAULT_BASE_URL)
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
  })

  it('migrates legacy genspark provider selection to local', () => {
    const defaults = defaultAiSettings()
    const resolved = resolveAiSettings(
      {
        provider: 'genspark',
        providers: {
          genspark: { apiKey: '', model: 'claude-opus-4-7' },
        } as never,
      },
      defaults,
    )
    expect(resolved.provider).toBe('local')
    expect((resolved.providers as Record<string, unknown>).genspark).toBeUndefined()
  })
})
