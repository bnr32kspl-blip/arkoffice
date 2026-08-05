/**
 * Thin FIFO queue in front of llama-server (-np 1).
 * Public clients hit this proxy; only one inference POST is forwarded at a time.
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse, Server } from 'node:http'

export interface LlmQueueStatus {
  active: boolean
  waiting: number
  /** 1-based place in the waiting line; 0 = currently being served; omitted if unknown */
  positionById: Record<string, number>
}

export interface LlmQueueProxyOptions {
  listenHost: string
  listenPort: number
  upstreamHost: string
  upstreamPort: number
}

interface Ticket {
  id: string
  resolve: () => void
  reject: (err: Error) => void
}

function isQueuedInference(method: string | undefined, url: string | undefined): boolean {
  if ((method ?? 'GET').toUpperCase() !== 'POST') return false
  const path = (url ?? '').split('?')[0] ?? ''
  return (
    path.endsWith('/chat/completions') ||
    path.endsWith('/completions') ||
    path.endsWith('/completion') ||
    path.endsWith('/embeddings') ||
    path === '/completion'
  )
}

function requestIdFrom(req: IncomingMessage): string {
  const raw = req.headers['x-arkoffice-request-id']
  const v = Array.isArray(raw) ? raw[0] : raw
  return (v && v.trim()) || randomUUID()
}

export function resolveUpstreamPort(publicPort: number): number {
  const candidate = publicPort + 10_000
  if (candidate <= 65_535) return candidate
  const fallback = publicPort - 10_000
  return fallback >= 1 ? fallback : Math.max(1, publicPort - 1)
}

export function createLlmQueueProxy(opts: LlmQueueProxyOptions): {
  start(): Promise<void>
  stop(): Promise<void>
  getStatus(): LlmQueueStatus
  readonly listenPort: number
  readonly upstreamPort: number
} {
  let server: Server | null = null
  let activeId: string | null = null
  const waiting: Ticket[] = []
  const waiters = new Map<string, Ticket>()

  const getStatus = (): LlmQueueStatus => {
    const positionById: Record<string, number> = {}
    if (activeId) positionById[activeId] = 0
    waiting.forEach((t, i) => {
      positionById[t.id] = i + 1
    })
    return {
      active: activeId !== null,
      waiting: waiting.length,
      positionById,
    }
  }

  const promote = () => {
    if (activeId !== null) return
    const next = waiting.shift()
    if (!next) return
    waiters.delete(next.id)
    activeId = next.id
    next.resolve()
  }

  const released = new Set<string>()
  const release = (id: string) => {
    if (released.has(id)) return
    released.add(id)
    if (activeId === id) {
      activeId = null
      promote()
      return
    }
    const idx = waiting.findIndex((t) => t.id === id)
    if (idx >= 0) {
      const [removed] = waiting.splice(idx, 1)
      if (removed) {
        waiters.delete(removed.id)
        removed.reject(new Error('aborted'))
      }
    }
  }

  const enqueue = (id: string, signal: AbortSignal): Promise<void> =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('aborted'))
        return
      }
      const ticket: Ticket = {
        id,
        resolve: () => resolve(),
        reject,
      }
      waiting.push(ticket)
      waiters.set(id, ticket)
      const onAbort = () => {
        release(id)
      }
      signal.addEventListener('abort', onAbort, { once: true })
      const clear = () => signal.removeEventListener('abort', onAbort)
      const origResolve = ticket.resolve
      const origReject = ticket.reject
      ticket.resolve = () => {
        clear()
        origResolve()
      }
      ticket.reject = (err) => {
        clear()
        origReject(err)
      }
      promote()
    })

  const pipeUpstream = (clientReq: IncomingMessage, clientRes: ServerResponse): void => {
    const headers = { ...clientReq.headers }
    delete headers['host']
    headers.host = `${opts.upstreamHost}:${opts.upstreamPort}`

    const upReq = http.request(
      {
        hostname: opts.upstreamHost,
        port: opts.upstreamPort,
        path: clientReq.url,
        method: clientReq.method,
        headers,
      },
      (upRes) => {
        clientRes.writeHead(upRes.statusCode ?? 502, upRes.headers)
        upRes.pipe(clientRes)
      },
    )
    upReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' })
        clientRes.end(JSON.stringify({ error: { message: err.message } }))
      } else {
        clientRes.destroy(err)
      }
    })
    clientReq.pipe(upReq)
    clientReq.on('aborted', () => {
      upReq.destroy()
    })
    clientRes.on('close', () => {
      if (!clientRes.writableEnded) upReq.destroy()
    })
  }

  const handleQueueStatus = (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${opts.listenHost}:${opts.listenPort}`)
    const id = url.searchParams.get('id')
    const status = getStatus()
    const body =
      id && status.positionById[id] !== undefined
        ? {
            ...status,
            position: status.positionById[id],
            requestId: id,
          }
        : status
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(body))
  }

  const onRequest = (clientReq: IncomingMessage, clientRes: ServerResponse) => {
    const path = (clientReq.url ?? '').split('?')[0] ?? ''
    if (clientReq.method === 'GET' && (path === '/arkoffice/queue' || path === '/arkoffice/queue/')) {
      handleQueueStatus(clientReq, clientRes)
      return
    }

    if (!isQueuedInference(clientReq.method, clientReq.url)) {
      pipeUpstream(clientReq, clientRes)
      return
    }

    const id = requestIdFrom(clientReq)
    const ac = new AbortController()
    const onClientGone = () => ac.abort()
    clientReq.on('aborted', onClientGone)
    clientRes.on('close', () => {
      if (!clientRes.writableEnded) ac.abort()
    })

    void enqueue(id, ac.signal)
      .then(() => {
        if (ac.signal.aborted) {
          release(id)
          if (!clientRes.headersSent) {
            clientRes.writeHead(499)
            clientRes.end()
          }
          return
        }
        const finish = () => release(id)
        clientRes.on('finish', finish)
        clientRes.on('close', finish)
        pipeUpstream(clientReq, clientRes)
      })
      .catch(() => {
        if (!clientRes.headersSent) {
          clientRes.writeHead(499)
          clientRes.end()
        }
      })
  }

  return {
    listenPort: opts.listenPort,
    upstreamPort: opts.upstreamPort,
    getStatus,
    start() {
      return new Promise((resolve, reject) => {
        if (server) {
          resolve()
          return
        }
        const s = http.createServer(onRequest)
        s.once('error', reject)
        s.listen(opts.listenPort, opts.listenHost, () => {
          server = s
          resolve()
        })
      })
    },
    stop() {
      return new Promise((resolve) => {
        const s = server
        server = null
        activeId = null
        for (const t of waiting.splice(0)) {
          waiters.delete(t.id)
          t.reject(new Error('proxy-stopped'))
        }
        if (!s) {
          resolve()
          return
        }
        s.close(() => resolve())
        // Force-close lingering keep-alives
        s.closeAllConnections?.()
      })
    },
  }
}

export type LlmQueueProxy = ReturnType<typeof createLlmQueueProxy>
