import { useEffect, useRef, useState } from 'react'
import { useI18n } from './locale'
import { LlmSettingsPanel } from './LlmSettingsPanel'
import { llmCopyForLang } from './llm-copy'

/** Language options for the sidebar settings menu (offline; no cloud account). */
const LANG_OPTIONS = [
  { value: 'ar', label: 'العربية' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'he', label: 'עברית' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'th', label: 'ไทย' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
] as const

/**
 * Bottom-left sidebar control: language, local LLM settings, cloud opt-in, and version.
 * Cloud features stay off by default (local-first); users enable them explicitly here.
 */
export function SidebarSettings() {
  const { lang, setLang, t } = useI18n()
  const llmCopy = llmCopyForLang(lang)
  const [showLlmSettings, setShowLlmSettings] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [langFly, setLangFly] = useState<{ left: number; bottom: number } | null>(null)
  const langRowRef = useRef<HTMLDivElement>(null)
  const langCloseTimer = useRef<number | null>(null)
  const [appVersion, setAppVersion] = useState('')
  const [cloudEnabled, setCloudEnabled] = useState(false)

  useEffect(() => {
    let alive = true
    void window.aiOffice.getAppVersion?.().then((v) => {
      if (alive && v) setAppVersion(v)
    })
    void window.aiOffice.cloudFeaturesEnabled?.().then((on) => {
      if (alive) setCloudEnabled(on)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target?.closest?.('.account-entry')) {
        setMenuOpen(false)
        setLangFly(null)
      }
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [menuOpen])

  const closeMenu = () => {
    setMenuOpen(false)
    setLangFly(null)
  }

  const toggleCloudFeatures = async () => {
    if (cloudEnabled) {
      await window.aiOffice.setCloudFeaturesEnabled(false)
      setCloudEnabled(false)
      return
    }
    const ok = window.confirm(
      `${t('cloudFeaturesConfirmTitle')}\n\n${t('cloudFeaturesConfirmDetail')}`,
    )
    if (!ok) return
    await window.aiOffice.setCloudFeaturesEnabled(true)
    setCloudEnabled(true)
  }

  const cancelLangFlyClose = () => {
    if (langCloseTimer.current !== null) {
      window.clearTimeout(langCloseTimer.current)
      langCloseTimer.current = null
    }
  }

  const openLangFly = () => {
    cancelLangFlyClose()
    const rect = langRowRef.current?.getBoundingClientRect()
    if (rect) setLangFly({ left: rect.right - 2, bottom: window.innerHeight - rect.bottom })
  }

  const scheduleLangFlyClose = () => {
    cancelLangFlyClose()
    langCloseTimer.current = window.setTimeout(() => setLangFly(null), 200)
  }

  useEffect(() => {
    if (!langFly) return
    const close = (event: Event) => {
      const target = event.target as Element | null
      if (target instanceof Element && target.closest('.lang-flyout')) return
      setLangFly(null)
    }
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('scroll', close, true)
      cancelLangFlyClose()
    }
  }, [langFly])

  return (
    <>
      <div className="account-entry">
        {menuOpen && (
          <div className="account-menu" role="menu">
            <button
              className="account-menu-item"
              role="menuitem"
              onClick={() => {
                closeMenu()
                setShowLlmSettings(true)
              }}
            >
              {llmCopy.settingsOpen}
            </button>
            <button
              className="account-menu-item cloud-toggle-row"
              role="menuitemcheckbox"
              aria-checked={cloudEnabled}
              title={t('cloudFeaturesHint')}
              onClick={() => {
                void toggleCloudFeatures()
              }}
            >
              <span className="cloud-toggle-text">
                <span className="cloud-toggle-label">{t('cloudFeatures')}</span>
                <span className="cloud-toggle-hint">{t('cloudFeaturesHint')}</span>
              </span>
              <span className={`cloud-switch${cloudEnabled ? ' on' : ''}`} aria-hidden="true">
                <span className="cloud-switch-knob" />
              </span>
            </button>
            <div className="account-menu-divider" />
            <div
              className="lang-row-wrap"
              ref={langRowRef}
              onMouseEnter={openLangFly}
              onMouseLeave={scheduleLangFlyClose}
            >
              <button
                className="account-menu-item lang-row"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={!!langFly}
                onClick={openLangFly}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.2" />
                  <ellipse cx="8" cy="8" rx="2.8" ry="6.3" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M2 5.9h12M2 10.1h12" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                <span className="lang-row-label">{t('language')}</span>
                <span className="lang-row-current">
                  {LANG_OPTIONS.find((opt) => opt.value === lang)?.label}
                </span>
                <svg
                  className="lang-row-chevron"
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <path
                    d="M4.5 2.5l4 3.5-4 3.5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
              {langFly && (
                <div
                  className="lang-flyout"
                  role="menu"
                  style={{ left: langFly.left, bottom: langFly.bottom }}
                >
                  {LANG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      role="menuitemradio"
                      aria-checked={lang === opt.value}
                      className={`lang-menu-item${lang === opt.value ? ' active' : ''}`}
                      onClick={() => {
                        closeMenu()
                        if (lang !== opt.value) setLang(opt.value)
                      }}
                    >
                      {opt.label}
                      {lang === opt.value && (
                        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                          <path
                            d="M2.5 6.2l2.4 2.4 4.6-5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {appVersion && (
              <div className="account-menu-version">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.2" />
                  <path
                    d="M8 7.4v3.4"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <circle cx="8" cy="5.1" r="0.8" fill="currentColor" />
                </svg>
                <span className="version-row-label">{t('versionLabel')}</span>
                <span className="version-row-value">{appVersion}</span>
              </div>
            )}
          </div>
        )}
        <button
          className="account-btn"
          onClick={() => {
            setMenuOpen((v) => !v)
            setLangFly(null)
          }}
          aria-expanded={menuOpen}
          title={t('settings')}
          aria-label={t('settings')}
        >
          <span className="account-avatar" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M8 1.6v1.4M8 13v1.4M1.6 8h1.4M13 8h1.4M3.3 3.3l1 1M11.7 11.7l1 1M3.3 12.7l1-1M11.7 4.3l1-1"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="account-text">
            <span className="account-name">{t('settings')}</span>
            <span className="account-sub">{t('settingsSub')}</span>
          </span>
        </button>
      </div>
      {showLlmSettings && <LlmSettingsPanel onClose={() => setShowLlmSettings(false)} />}
    </>
  )
}
