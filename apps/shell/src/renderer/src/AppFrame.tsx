import { useEffect, useState } from 'react'
import { Home } from './Home'
import { LlmRuntimeWizard } from './LlmRuntimeWizard'
import { TabBar } from './TabBar'

interface AppFrameProps {
  /** legacy flag; Community onboarding was removed — still persisted as seen on launch */
  initialOnboardingSeen: boolean
  /** LLM runtime wizard completion flag (app-settings.json) */
  initialLlmRuntimeSeen: boolean
}

export function AppFrame({ initialOnboardingSeen, initialLlmRuntimeSeen }: AppFrameProps) {
  const [homeActive, setHomeActive] = useState(true)
  const [showLlmWizard, setShowLlmWizard] = useState(!initialLlmRuntimeSeen)

  useEffect(() => {
    const applyTabs = (tabs: Awaited<ReturnType<typeof window.aiOfficeTabs.list>>) => {
      const active = tabs.find((tab) => tab.active)
      setHomeActive(!active || active.kind === 'home')
    }
    void window.aiOfficeTabs.list().then(applyTabs)
    return window.aiOfficeTabs.onChanged(applyTabs)
  }, [])

  // First-run Community / marketing onboarding is disabled; persist the flag so
  // upgrades and e2e stay consistent with "already completed".
  useEffect(() => {
    if (!initialOnboardingSeen) {
      void window.aiOffice.setOnboardingSeen().catch(() => {})
    }
  }, [initialOnboardingSeen])

  return (
    <div className="app-frame">
      <TabBar />
      {/* docs/sheets tabs render as WebContentsView children of this window, positioned
       * by the main process to cover this area — only Home paints its own content here. */}
      <div className="app-frame-content" style={{ visibility: homeActive ? 'visible' : 'hidden' }}>
        <Home />
      </div>
      {/* editor WebContentsViews paint above ALL shell DOM, so the overlay only
       * renders while the home tab is active — it comes back when home does */}
      {showLlmWizard && homeActive && (
        <LlmRuntimeWizard onDone={() => setShowLlmWizard(false)} />
      )}
    </div>
  )
}
