import { describe, expect, it, vi } from 'vitest'
import { queueOriginFromBaseUrl, startLlmQueuePoll } from '../src/queue-status'

describe('queueOriginFromBaseUrl', () => {
  it('strips the /v1 path', () => {
    expect(queueOriginFromBaseUrl('http://127.0.0.1:8080/v1')).toBe('http://127.0.0.1:8080')
  })
})

describe('startLlmQueuePoll', () => {
  it('reports queue status then stops on 404', async () => {
    const onQueue = vi.fn()
    let calls = 0
    const fetchMock = vi.fn(async () => {
      calls += 1
      if (calls === 1) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ waiting: 2, position: 2, active: true }),
        }
      }
      return { status: 404, ok: false, json: async () => ({}) }
    })
    vi.stubGlobal('fetch', fetchMock)

    const poll = startLlmQueuePoll({
      baseUrl: 'http://127.0.0.1:8080/v1',
      requestId: 'r1',
      intervalMs: 10,
      onQueue,
    })
    await new Promise((r) => setTimeout(r, 50))
    poll.stop()
    vi.unstubAllGlobals()

    expect(onQueue).toHaveBeenCalledWith({ waiting: 2, position: 2 })
  })
})
