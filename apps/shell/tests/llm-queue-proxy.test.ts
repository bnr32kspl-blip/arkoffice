import { createServer } from 'node:http'
import { describe, expect, it } from 'vitest'
import {
  createLlmQueueProxy,
  resolveUpstreamPort,
} from '../src/main/llm-queue-proxy'

function listenUpstream(): Promise<{ port: number; close: () => Promise<void>; hits: string[] }> {
  const hits: string[] = []
  const server = createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`)
    if (req.url?.includes('/arkoffice/')) {
      res.writeHead(404)
      res.end()
      return
    }
    // Slow inference slot: hold POST bodies briefly so queue builds up
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (c) => {
        body += c
      })
      req.on('end', () => {
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, echo: body.length }))
        }, 80)
      })
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'm' }] }))
  })
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('no port'))
        return
      }
      resolve({
        port: addr.port,
        hits,
        close: () =>
          new Promise((r) => {
            server.close(() => r())
          }),
      })
    })
  })
}

describe('resolveUpstreamPort', () => {
  it('offsets by 10000 when in range', () => {
    expect(resolveUpstreamPort(8080)).toBe(18080)
  })

  it('falls back when offset would overflow', () => {
    expect(resolveUpstreamPort(60000)).toBe(50000)
  })
})

describe('createLlmQueueProxy', () => {
  it('exposes /arkoffice/queue and serializes inference POSTs', async () => {
    const upstream = await listenUpstream()
    const proxyPort = await new Promise<number>((resolve, reject) => {
      const probe = createServer()
      probe.listen(0, '127.0.0.1', () => {
        const addr = probe.address()
        if (!addr || typeof addr === 'string') reject(new Error('no port'))
        else {
          const p = addr.port
          probe.close(() => resolve(p))
        }
      })
    })

    const proxy = createLlmQueueProxy({
      listenHost: '127.0.0.1',
      listenPort: proxyPort,
      upstreamHost: '127.0.0.1',
      upstreamPort: upstream.port,
    })
    await proxy.start()

    try {
      const models = await fetch(`http://127.0.0.1:${proxyPort}/v1/models`)
      expect(models.ok).toBe(true)

      const first = fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ArkOffice-Request-Id': 'req-a',
        },
        body: JSON.stringify({ model: 'm', messages: [] }),
      })
      // Give first request time to become active
      await new Promise((r) => setTimeout(r, 20))

      const second = fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ArkOffice-Request-Id': 'req-b',
        },
        body: JSON.stringify({ model: 'm', messages: [] }),
      })
      await new Promise((r) => setTimeout(r, 20))

      const status = await fetch(`http://127.0.0.1:${proxyPort}/arkoffice/queue?id=req-b`)
      expect(status.ok).toBe(true)
      const body = (await status.json()) as {
        waiting: number
        active: boolean
        position: number
      }
      expect(body.active).toBe(true)
      expect(body.waiting).toBeGreaterThanOrEqual(1)
      expect(body.position).toBe(1)

      const [a, b] = await Promise.all([first, second])
      expect(a.ok).toBe(true)
      expect(b.ok).toBe(true)

      const postHits = upstream.hits.filter((h) => h.startsWith('POST'))
      expect(postHits.length).toBe(2)
    } finally {
      await proxy.stop()
      await upstream.close()
    }
  })

  it('removes aborted waiters from the queue', async () => {
    const upstream = await listenUpstream()
    const proxyPort = await new Promise<number>((resolve, reject) => {
      const probe = createServer()
      probe.listen(0, '127.0.0.1', () => {
        const addr = probe.address()
        if (!addr || typeof addr === 'string') reject(new Error('no port'))
        else {
          const p = addr.port
          probe.close(() => resolve(p))
        }
      })
    })

    const proxy = createLlmQueueProxy({
      listenHost: '127.0.0.1',
      listenPort: proxyPort,
      upstreamHost: '127.0.0.1',
      upstreamPort: upstream.port,
    })
    await proxy.start()

    try {
      const ac = new AbortController()
      const blocker = fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ArkOffice-Request-Id': 'hold',
        },
        body: JSON.stringify({ model: 'm' }),
      })
      await new Promise((r) => setTimeout(r, 15))

      const waiting = fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ArkOffice-Request-Id': 'cancel-me',
        },
        body: JSON.stringify({ model: 'm' }),
        signal: ac.signal,
      })
      await new Promise((r) => setTimeout(r, 15))
      expect(proxy.getStatus().waiting).toBeGreaterThanOrEqual(1)
      ac.abort()
      await waiting.catch(() => {})
      await new Promise((r) => setTimeout(r, 20))
      expect(proxy.getStatus().positionById['cancel-me']).toBeUndefined()
      await blocker
    } finally {
      await proxy.stop()
      await upstream.close()
    }
  })
})
