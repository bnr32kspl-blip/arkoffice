import { useEffect, useState } from 'react'
import type { AiSettings, LlmRuntimeMode } from '@arkoffice/ai-provider'
import {
  applyRuntimeModeToSettings,
  applySelectedGgufToSettings,
  defaultAiSettings,
  normalizeRemoteBaseUrl,
} from '@arkoffice/ai-provider'
import type { GgufModelsSnapshot } from '../../shared/llm-models-api'
import { useI18n } from './locale'
import { formatGgufSize, llmCopyForLang } from './llm-copy'
import './llm-runtime.css'

interface LlmRuntimeWizardProps {
  onDone: () => void
}

type Step = 'mode' | 'remote' | 'model'

export function LlmRuntimeWizard({ onDone }: LlmRuntimeWizardProps) {
  const { lang } = useI18n()
  const c = llmCopyForLang(lang)
  const [step, setStep] = useState<Step>('mode')
  const [mode, setMode] = useState<LlmRuntimeMode>('local')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<GgufModelsSnapshot | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (step !== 'model') return
    void window.aiOffice.listGgufModels().then((snap) => {
      setSnapshot(snap)
      setSelectedId(snap.selectedId)
      if (snap.error) setError(c.modelsError)
    })
  }, [step, c.modelsError])

  const persist = async (
    configured: boolean,
    nextMode: LlmRuntimeMode,
    url: string,
    modelId: string | null,
  ) => {
    const base = await window.aiOffice.getAiSettings().catch(() => defaultAiSettings())
    let draft: AiSettings = {
      ...base,
      runtimeMode: nextMode,
      remoteBaseUrl: url,
      selectedModelFile: nextMode === 'local' ? modelId : base.selectedModelFile,
      llmRuntimeConfigured: configured,
      provider: 'local',
    }
    if (nextMode === 'remote') {
      const normalized = normalizeRemoteBaseUrl(url)
      if (!normalized) throw new Error('invalid-url')
      draft = { ...draft, remoteBaseUrl: normalized }
    }
    let next = applyRuntimeModeToSettings(draft)
    if (nextMode === 'local' && modelId) {
      const fileName = snapshot?.models.find((m) => m.id === modelId)?.fileName ?? null
      next = applySelectedGgufToSettings(next, fileName)
    }
    await window.aiOffice.setAiSettings(next)
  }

  const finish = async (skip: boolean) => {
    setError('')
    setBusy(true)
    try {
      if (skip) {
        await persist(false, 'local', '', null)
      } else if (mode === 'remote') {
        await persist(true, 'remote', remoteUrl, null)
      } else {
        await persist(true, 'local', '', selectedId)
      }
      await window.aiOffice.setLlmRuntimeSeen()
      onDone()
    } catch (e) {
      if (e instanceof Error && e.message === 'invalid-url') setError(c.remoteUrlInvalid)
      else setError(c.saveFailed)
    } finally {
      setBusy(false)
    }
  }

  const goNext = () => {
    setError('')
    if (step === 'mode') {
      if (mode === 'remote') setStep('remote')
      else setStep('model')
      return
    }
    if (step === 'remote') {
      void finish(false)
      return
    }
    void finish(false)
  }

  const goBack = () => {
    setError('')
    if (step === 'remote' || step === 'model') setStep('mode')
  }

  return (
    <div className="llm-overlay" role="dialog" aria-modal="true" aria-labelledby="llm-wizard-title">
      <div className="llm-dialog llm-wizard">
        <h2 id="llm-wizard-title">{c.wizardTitle}</h2>
        {step === 'mode' && (
          <>
            <p className="llm-intro">{c.wizardIntro}</p>
            <fieldset className="llm-fieldset">
              <legend>{c.modeLabel}</legend>
              <label className="llm-choice">
                <input
                  type="radio"
                  name="llm-wizard-mode"
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
                  name="llm-wizard-mode"
                  checked={mode === 'remote'}
                  onChange={() => setMode('remote')}
                />
                <span>
                  <strong>{c.modeRemote}</strong>
                  <small>{c.modeRemoteHint}</small>
                </span>
              </label>
            </fieldset>
          </>
        )}
        {step === 'remote' && (
          <>
            <p className="llm-intro">{c.wizardRemoteStep}</p>
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
          </>
        )}
        {step === 'model' && (
          <>
            <p className="llm-intro">{c.wizardModelStep}</p>
            {snapshot && (
              <p className="llm-models-path">
                {c.modelsDirLabel}: <code>{snapshot.path}</code>
              </p>
            )}
            <div className="llm-models-actions wizard-models-actions">
              <button
                type="button"
                className="llm-btn ghost compact"
                onClick={() =>
                  void window.aiOffice.listGgufModels().then((snap) => {
                    setSnapshot(snap)
                    setSelectedId(snap.selectedId)
                  })
                }
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
            {!snapshot?.models.length ? (
              <p className="llm-note">{c.modelsEmpty}</p>
            ) : (
              <ul className="llm-model-list">
                {snapshot.models.map((m) => (
                  <li key={m.id}>
                    <label className="llm-choice">
                      <input
                        type="radio"
                        name="llm-wizard-model"
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
          </>
        )}

        {error && <p className="llm-error">{error}</p>}

        <div className="llm-actions">
          <button
            type="button"
            className="llm-btn ghost"
            onClick={() => void finish(true)}
            disabled={busy}
          >
            {c.wizardSkip}
          </button>
          <div className="llm-actions-right">
            {step !== 'mode' && (
              <button type="button" className="llm-btn ghost" onClick={goBack} disabled={busy}>
                {c.wizardBack}
              </button>
            )}
            <button type="button" className="llm-btn primary" onClick={goNext} disabled={busy}>
              {step === 'mode' ? c.wizardNext : c.wizardFinish}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
