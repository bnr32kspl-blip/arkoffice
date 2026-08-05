import React from 'react'
import { createRoot } from 'react-dom/client'
import { htmlLang } from '@arkoffice/i18n'
import { AppFrame } from './AppFrame'
import { LocaleProvider } from './locale'
import './home.css'
import './tabbar.css'

// macOS shell window is created with vibrancy; a transparent body lets the
// editor views' translucent regions (e.g. slides thumbnail pane) show it
if (navigator.platform.toLowerCase().includes('mac')) document.body.classList.add('vib')

// resolve the persisted language and first-run flags before first paint so
// the UI never flashes (home / LLM wizard showing briefly before overlays)
void Promise.all([
  window.aiOffice.getLanguage(),
  // marketing onboarding removed; treat unread/missing as already seen
  window.aiOffice.onboardingSeen().catch(() => true),
  window.aiOffice.llmRuntimeSeen().catch(() => true),
]).then(([lang, onboardingSeen, llmRuntimeSeen]) => {
  document.documentElement.lang = htmlLang(lang)
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <LocaleProvider initial={lang}>
        <AppFrame
          initialOnboardingSeen={onboardingSeen}
          initialLlmRuntimeSeen={llmRuntimeSeen}
        />
      </LocaleProvider>
    </React.StrictMode>,
  )
})
