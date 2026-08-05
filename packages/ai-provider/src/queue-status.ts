/**
 * Poll ArkOffice queue proxy status while a local/custom OpenAI-compatible
 * request is waiting for response headers (FIFO slot).
 */
export interface LlmQueueInfo {
  waiting: number
  /** 1-based place in line; 0 = being served; null if unknown */
  position: number | null
}

export function queueOriginFromBaseUrl(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl.includes('://') ? baseUrl : `http://${baseUrl}`)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

/**
 * Start polling `/arkoffice/queue` until stop() is called.
 * Missing endpoint (404) or network errors stop quietly after a few failures.
 */
export function startLlmQueuePoll(options: {
  baseUrl: string
  requestId?: string
  signal?: AbortSignal
  intervalMs?: number
  onQueue: (info: LlmQueueInfo) => void
  /** keepalive for IPC silence watchdogs (does not extend connect timeout) */
  onActivity?: () => void
}): { stop: () => void } {
  const origin = queueOriginFromBaseUrl(options.baseUrl)
  if (!origin) return { stop: () => {} }

  const intervalMs = options.intervalMs ?? 700
  let stopped = false
  let misses = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = () => {
    stopped = true
    clearTimeout(timer)
  }

  if (options.signal?.aborted) return { stop }
  options.signal?.addEventListener('abort', stop, { once: true })

  const tick = async () => {
    if (stopped) return
    try {
      const q = options.requestId
        ? `${origin}/arkoffice/queue?id=${encodeURIComponent(options.requestId)}`
        : `${origin}/arkoffice/queue`
      const res = await fetch(q, {
        signal: AbortSignal.timeout(2000),
        headers: { Accept: 'application/json' },
      })
      if (res.status === 404) {
        stop()
        return
      }
      if (!res.ok) {
        misses += 1
        if (misses >= 5) stop()
        else schedule()
        return
      }
      misses = 0
      const data = (await res.json()) as {
        waiting?: number
        position?: number
        positionById?: Record<string, number>
        active?: boolean
      }
      let position: number | null = null
      if (typeof data.position === 'number') position = data.position
      else if (options.requestId && data.positionById) {
        const p = data.positionById[options.requestId]
        position = typeof p === 'number' ? p : null
      }
      const waiting = typeof data.waiting === 'number' ? data.waiting : 0
      // Only surface when there is contention or we know our place in line
      if (waiting > 0 || (position !== null && position > 0) || data.active) {
        options.onQueue({ waiting, position })
        options.onActivity?.()
      }
    } catch {
      misses += 1
      if (misses >= 8) {
        stop()
        return
      }
    }
    schedule()
  }

  const schedule = () => {
    if (stopped) return
    timer = setTimeout(() => {
      void tick()
    }, intervalMs)
  }

  void tick()
  return { stop }
}
