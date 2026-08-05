export type {
  AiChatRequest,
  AiChatResponse,
  AiProviderConfig,
  AiProviderId,
  AiProviderMeta,
  AiSettings,
  AiStreamChunk,
  AiStreamRequest,
  ToolCliAccountStatus,
  LegacyAiSettings,
  LlmBackendId,
  LlmRuntimeMode,
} from './types'
export {
  AI_PROVIDERS,
  LOCAL_LLM_DEFAULT_BASE_URL,
  LOCAL_LLM_DEFAULT_PORT,
  applyRuntimeModeToSettings,
  applySelectedGgufToSettings,
  defaultAiSettings,
  localBaseUrlForPort,
  normalizeRemoteBaseUrl,
  resolveAiSettings,
} from './providers'
export {
  compareGgufFileName,
  ggufModelApiId,
  normalizeGgufRelativeId,
  pickGgufModel,
  sortGgufModelRefs,
} from './gguf-models'
export type { GgufModelId, GgufModelRef } from './gguf-models'

export { chatForProvider } from './chat'
export { AiCreditsError, sseLines, streamForProvider } from './stream'
export type { StreamCallbacks } from './stream'
export { queueOriginFromBaseUrl, startLlmQueuePoll } from './queue-status'
export type { LlmQueueInfo } from './queue-status'
export {
  AI_CHAT_RESPONSE_TIMEOUT_MS,
  AI_CONNECT_TIMEOUT_MS,
  AI_IDLE_TIMEOUT_MS,
  AiTimeoutError,
  createStreamWatchdog,
} from './watchdog'
export type { StreamWatchdog } from './watchdog'
