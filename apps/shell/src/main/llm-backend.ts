/**
 * Pure backend selection helpers (no Electron / no process spawn).
 */
export type LlmBinaryKind = 'cuda' | 'vulkan' | 'cpu'

export type LlmBackendPreference = 'auto' | LlmBinaryKind

export const LLM_BINARY_NAMES: Record<LlmBinaryKind, string> = {
  cuda: 'llama-server-cuda.exe',
  vulkan: 'llama-server-vulkan.exe',
  cpu: 'llama-server-cpu.exe',
}

export const LLM_FALLBACK_ORDER: LlmBinaryKind[] = ['cuda', 'vulkan', 'cpu']

export const LLM_LOOPBACK_HOST = '127.0.0.1'
export const LLM_LAN_BIND_HOST = '0.0.0.0'

/**
 * Resolve llama-server --host.
 * Default loopback; LAN bind only when explicitly opted in (settings or env).
 * Env `ARKOFFICE_LLM_LISTEN_LAN=1` forces LAN bind (admin override).
 */
export function resolveListenHost(options: {
  listenLan: boolean
  envListenLan?: string | undefined
}): string {
  const env = (options.envListenLan ?? process.env.ARKOFFICE_LLM_LISTEN_LAN)?.trim()
  if (env === '1' || env?.toLowerCase() === 'true') return LLM_LAN_BIND_HOST
  return options.listenLan ? LLM_LAN_BIND_HOST : LLM_LOOPBACK_HOST
}

/**
 * Resolve which binary to try first given preference + availability.
 * Returns ordered try list (auto may include fallbacks).
 */
export function resolveBackendTryOrder(
  preference: LlmBackendPreference,
  available: LlmBinaryKind[],
  detected: LlmBinaryKind,
): LlmBinaryKind[] {
  if (available.length === 0) return []
  if (preference !== 'auto') {
    return available.includes(preference) ? [preference] : []
  }
  const start = LLM_FALLBACK_ORDER.indexOf(detected)
  const ordered =
    start >= 0
      ? [...LLM_FALLBACK_ORDER.slice(start), ...LLM_FALLBACK_ORDER.slice(0, start)]
      : [...LLM_FALLBACK_ORDER]
  return ordered.filter((k) => available.includes(k))
}
