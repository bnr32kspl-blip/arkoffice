import { useCallback, useEffect, useState } from 'react'
import type { AiSettings, LlmBackendId, LlmRuntimeMode } from '@arkoffice/ai-provider'
import {
  applyRuntimeModeToSettings,
  applySelectedGgufToSettings,
  defaultAiSettings,
  normalizeRemoteBaseUrl,
} from '@arkoffice/ai-provider'
import type {
  GgufModelsSnapshot,
  LlmRuntimeStatusDto,
} from '../../shared/llm-models-api'
import { useI18n } from './locale'
import { formatGgufSize, llmCopyForLang } from './llm-copy'
import './llm-runtime.css'

interface LlmSettingsPanelProps {
  onClose: () => void
}

export function LlmSettingsPanel({ onClose }: LlmSettingsPanelProps) {
  const { lang } = useI18n()
  const c = llmCopyForLang(lang)
  const [settings, setSettings] = useState<AiSettings>(defaultAiSettings())
  const [mode, setMode] = useState<LlmRuntimeMode>('local')
  const [backend, setBackend] = useState<LlmBackendId>('auto')
  const [listenLan, setListenLan] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<GgufModelsSnapshot | null>(null)
  const [runtime, setRuntime] = useState<LlmRuntimeStatusDto | null>(null)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshModels = useCallback(async () => {
    const snap = await window.aiOffice.listGgufModels()
    setSnapshot(snap)
    setSelectedId(snap.selectedId)
    if (snap.error) setError(c.modelsError)
    return snap
  }, [c.modelsError])

  const refreshRuntime = useCallback(async () => {
    const st = await window.aiOffice.llmRuntimeStatus()
    setRuntime(st)
    return st
  }, [])

  useEffect(() => {
    void (async () => {
      const s = await window.aiOffice.getAiSettings()
      setSettings(s)
      setMode(s.runtimeMode)
      setBackend(s.backend)
      setListenLan(s.listenLan)
      setRemoteUrl(s.remoteBaseUrl || '')
      await refreshModels()
      await refreshRuntime()
    })()
  }, [refreshModels, refreshRuntime])

  const save = async () => {
    setError('')
    setStatusMsg('')
    if (mode === 'remote') {
      const normalized = normalizeRemoteBaseUrl(remoteUrl)
      if (!normalized) {
        setError(c.remoteUrlInvalid)
        return
      }
      setRemoteUrl(normalized)
    }
    setBusy(true)
    try {
      const fileName = snapshot?.models.find((m) => m.id === selectedId)?.fileName ?? null
      let next = applyRuntimeModeToSettings({
        ...settings,
        runtimeMode: mode,
        backend,
        listenLan: mode === 'local' ? listenLan : false,
        remoteBaseUrl: mode === 'remote' ? remoteUrl.trim() : settings.remoteBaseUrl,
        selectedModelFile: mode === 'local' ? selectedId : settings.selectedModelFile,
        llmRuntimeConfigured: true,
        provider: 'local',
      })
      if (mode === 'local') {
        next = applySelectedGgufToSettings(next, fileName)
      }
      await window.aiOffice.setAiSettings(next)
      setSettings(next)
      const rt = await window.aiOffice.llmRuntimeEnsure()
      setRuntime(rt)
      setStatusMsg(c.saved)
      await refreshModels()
    } catch {
      setError(c.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="llm-overlay" role="dialog" aria-modal="true" aria-labelledby="llm-settings-title">
      <div className="llm-dialog">
        <h2 id="llm-settings-title">{c.settingsTitle}</h2>
        <fieldset className="llm-fieldset">
          <legend>{c.modeLabel}</legend>
          <label className="llm-choice">
            <input
              type="radio"
              name="llm-mode"
              checked={mode === 'local'}
              onChange={() => setMode('local')}
            />
            <span>
              <strong>{c.modeLocal}</strong>
              <small>{c.modeLocalHint}</small>
            </span>
          </label>
          <label className="llm-choice">
            <input
              type="radio"
              name="llm-mode"
              checked={mode === 'remote'}
              onChange={() => setMode('remote')}
            />
            <span>
              <strong>{c.modeRemote}</strong>
              <small>{c.modeRemoteHint}</small>
            </span>
          </label>
        </fieldset>

        {mode === 'local' ? (
          <>
            <p className="llm-note">{c.localNote}</p>
            <label className="llm-choice llm-listen">
              <input
                type="checkbox"
                checked={listenLan}
                onChange={(e) => setListenLan(e.target.checked)}
              />
              <span>
                <strong>{c.listenLanLabel}</strong>
                <small>{c.listenLanHint}</small>
              </span>
            </label>
            {listenLan && <p className="llm-warn">{c.listenLanWarn}</p>}
            <fieldset className="llm-fieldset">
              <legend>{c.backendLabel}</legend>
              {(
                [
                  ['auto', c.backendAuto],
                  ['cuda', c.backendCuda],
                  ['vulkan', c.backendVulkan],
                  ['cpu', c.backendCpu],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className="llm-choice">
                  <input
                    type="radio"
                    name="llm-backend"
                    checked={backend === id}
                    onChange={() => setBackend(id)}
                  />
                  <span>
                    <strong>{label}</strong>
                  </span>
                </label>
              ))}
              {runtime && (
                <p className="llm-note">
                  {c.backendDetected.replace('{v}', runtime.detectedBackend)}
                  {runtime.availableBinaries.length
                    ? ` · bin: ${runtime.availableBinaries.join(', ')}`
                    : ' · bin: (none)'}
                </p>
              )}
            </fieldset>
            <div className="llm-models">
              <div className="llm-models-head">
                <span>{c.modelsLabel}</span>
                <div className="llm-models-actions">
                  <button
                    type="button"
                    className="llm-btn ghost compact"
                    onClick={() => void refreshModels()}
                    disabled={busy}
                  >
                    {c.modelsReload}
                  </button>
                  <button
                    type="button"
                    className="llm-btn ghost compact"
                    onClick={() => void window.aiOffice.revealModelsDir()}
                    disabled={busy}
                  >
                    {c.modelsReveal}
                  </button>
                </div>
              </div>
              {snapshot && (
                <p className="llm-models-path">
                  {c.modelsDirLabel}: <code>{snapshot.path}</code>
                </p>
              )}
              {snapshot?.missingSelection && <p className="llm-warn">{c.modelsMissing}</p>}
              {!snapshot?.models.length ? (
                <p className="llm-note">{c.modelsEmpty}</p>
              ) : (
                <ul className="llm-model-list">
                  {snapshot.models.map((m) => (
                    <li key={m.id}>
                      <label className="llm-choice">
                        <input
                          type="radio"
                          name="llm-model"
                          checked={selectedId === m.id}
                          onChange={() => setSelectedId(m.id)}
                        />
                        <span>
                          <strong>{m.fileName}</strong>
                          <small>
                            {m.id} · {formatGgufSize(m.sizeBytes)}
                          </small>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="llm-runtime">
              <div className="llm-models-head">
                <span>{c.runtimeLabel}</span>
                <button
                  type="button"
                  className="llm-btn ghost compact"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true)
                    void window.aiOffice
                      .llmRuntimeEnsure()
                      .then(setRuntime)
                      .finally(() => setBusy(false))
                  }}
                >
                  {c.runtimeRefresh}
                </button>
              </div>
              {runtime && (
                <p className="llm-note">
                  {runtime.state}
                  {runtime.host ? ` · ${runtime.host}:${runtime.port}` : ''}
                  {runtime.upstreamPort ? ` → :${runtime.upstreamPort}` : ''}
                  {runtime.backendEffective ? ` · ${runtime.backendEffective}` : ''}
                  {runtime.pid ? ` · pid ${runtime.pid}` : ''}
                  {runtime.queue
                    ? ` · queue ${runtime.queue.waiting}${runtime.queue.active ? ' (+1 active)' : ''}`
                    : ''}
                  {runtime.message ? ` — ${runtime.message}` : ''}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <label className="llm-field">
              <span>{c.remoteUrlLabel}</span>
              <input
                type="url"
                value={remoteUrl}
                placeholder={c.remoteUrlPlaceholder}
                onChange={(e) => setRemoteUrl(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <p className="llm-note">{c.remoteQueueNote}</p>
          </>
        )}

        {error && <p className="llm-error">{error}</p>}
        {statusMsg && <p className="llm-status">{statusMsg}</p>}

        <div className="llm-actions">
          <button type="button" className="llm-btn ghost" onClick={onClose} disabled={busy}>
            {c.cancel}
          </button>
          <button type="button" className="llm-btn primary" onClick={() => void save()} disabled={busy}>
            {c.save}
          </button>
        </div>
      </div>
    </div>
  )
}
