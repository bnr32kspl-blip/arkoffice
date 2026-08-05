import type { AgentMessage, AgentToolCall, AgentToolDef } from '@arkoffice/agent-core'

export type AiProviderId =
  | 'local'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'openai'
  | 'custom'

/**
 * @deprecated Kept for IPC compatibility while ArkOffice auth is being removed.
 * Always treat as optional; ArkOffice does not require this for AI.
 */
export interface ToolCliAccountStatus {
  loggedIn: boolean
  email?: string
}

export interface AiProviderConfig {
  apiKey: string
  model: string
  /** used by local and custom (OpenAI-compatible) providers */
  baseUrl?: string | undefined
}

export interface AiProviderMeta {
  id: AiProviderId
  label: string
  models: string[]
  defaultModel: string
  keyPlaceholder: string
  needsBaseUrl?: boolean
}

/** Local bundled llama-server vs remote OpenAI-compatible host */
export type LlmRuntimeMode = 'local' | 'remote'

/** Which llama-server binary to launch (L3); stored from L1 for forward compatibility */
export type LlmBackendId = 'auto' | 'cuda' | 'vulkan' | 'cpu'

export interface AiSettings {
  provider: AiProviderId
  providers: Record<AiProviderId, AiProviderConfig>
  /**
   * How the local OpenAI-compatible endpoint is provided.
   * `local` = bundled/runtime on this machine; `remote` = Base URL only (no local server).
   */
  runtimeMode: LlmRuntimeMode
  /** Free-form remote Base URL when runtimeMode is `remote` (synced into providers.local.baseUrl) */
  remoteBaseUrl: string
  /** Allow non-loopback bind when acting as an inference host (L4; default false) */
  listenLan: boolean
  /** GPU/CPU backend preference (L3; default auto) */
  backend: LlmBackendId
  /** Override for GGUF directory; null = platform default (L2) */
  modelsDir: string | null
  /** Selected GGUF basename/relative path; null = sort-first default (L2) */
  selectedModelFile: string | null
  /** Local llama-server listen port (default 8080) */
  port: number
  /** True after the LLM runtime first-run wizard completes */
  llmRuntimeConfigured: boolean
}

/** pre-provider settings shape (single OpenAI-compatible endpoint); migrated into "custom" */
export interface LegacyAiSettings {
  baseUrl?: string
  apiKey?: string
  model?: string
}

export interface AiChatRequest {
  settings: AiSettings
  system: string
  user: string
}

export interface AiChatResponse {
  ok: boolean
  content?: string
  error?: string
}

export interface AiStreamRequest {
  requestId: string
  settings: AiSettings
  system: string
  messages: AgentMessage[]
  tools?: AgentToolDef[]
  maxTokens?: number
}

export interface AiStreamChunk {
  requestId: string
  /** 'ping' = wire-level keepalive so the renderer can tell a live stream from a dead one */
  /** 'queue' = local LLM FIFO wait status (waiting count / position) */
  type: 'delta' | 'tool-call' | 'done' | 'error' | 'ping' | 'queue'
  text?: string
  /** complete parsed tool call (emitted once its arguments finish streaming) */
  toolCall?: AgentToolCall
  error?: string
  /** machine-readable error cause ('timeout', exhausted 'credits'); lets the renderer localize the message */
  errorCode?: 'timeout' | 'credits'
  /** normalized stop reason carried on 'done' ('max_tokens' = output cut off by the token limit) */
  stopReason?: string
  /** for type 'queue': how many inference requests are waiting ahead (0 = none / serving) */
  queueWaiting?: number
  /** for type 'queue': 1-based place in line; 0 = being served */
  queuePosition?: number
}
