import { describe, expect, it } from 'vitest'
import { resolveBackendTryOrder, resolveListenHost } from '../src/main/llm-backend'

describe('resolveBackendTryOrder', () => {
  it('returns only the manual backend when available', () => {
    expect(resolveBackendTryOrder('cuda', ['cuda', 'vulkan', 'cpu'], 'cpu')).toEqual(['cuda'])
    expect(resolveBackendTryOrder('vulkan', ['cpu'], 'cpu')).toEqual([])
  })

  it('auto starts from detected and falls back', () => {
    expect(resolveBackendTryOrder('auto', ['cuda', 'vulkan', 'cpu'], 'vulkan')).toEqual([
      'vulkan',
      'cpu',
      'cuda',
    ])
    expect(resolveBackendTryOrder('auto', ['cpu'], 'cuda')).toEqual(['cpu'])
  })
})

describe('resolveListenHost', () => {
  it('defaults to loopback when listenLan is false', () => {
    expect(resolveListenHost({ listenLan: false, envListenLan: '' })).toBe('127.0.0.1')
  })

  it('binds all interfaces when listenLan is true', () => {
    expect(resolveListenHost({ listenLan: true, envListenLan: '' })).toBe('0.0.0.0')
  })

  it('lets ARKOFFICE_LLM_LISTEN_LAN override settings', () => {
    expect(resolveListenHost({ listenLan: false, envListenLan: '1' })).toBe('0.0.0.0')
    expect(resolveListenHost({ listenLan: false, envListenLan: 'true' })).toBe('0.0.0.0')
  })
})
