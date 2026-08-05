/**
 * User-facing opt-in for optional online / cloud capabilities.
 *
 * Default is off (local-first). Persist in userData/app-settings.json under
 * `cloudFeaturesEnabled`, configured once at app startup via
 * {@link configureCloudFeatures}.
 *
 * Admin overrides:
 * - ARKOFFICE_CLOUD_FEATURES=1 force on
 * - ARKOFFICE_CLOUD_FEATURES=0 force off
 */

import { readFileSync, writeFileSync } from 'node:fs'

export const CLOUD_FEATURES_SETTING_KEY = 'cloudFeaturesEnabled'

let settingsPath: string | null = null

/** Point at the shared app-settings.json (same file as UI language). */
export function configureCloudFeatures(appSettingsPath: string): void {
  settingsPath = appSettingsPath
}

function readSettings(): Record<string, unknown> {
  if (!settingsPath) return {}
  try {
    const raw: unknown = JSON.parse(readFileSync(settingsPath, 'utf8'))
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>
    }
  } catch {
    /* missing or corrupt */
  }
  return {}
}

/** Whether the user (or admin env) has opted into optional cloud features. */
export function isCloudFeaturesEnabled(): boolean {
  if (process.env.ARKOFFICE_CLOUD_FEATURES === '0') return false
  if (process.env.ARKOFFICE_CLOUD_FEATURES === '1') return true
  return readSettings()[CLOUD_FEATURES_SETTING_KEY] === true
}

/** Persist the toggle. Throws if {@link configureCloudFeatures} was never called. */
export function setCloudFeaturesEnabled(enabled: boolean): void {
  if (!settingsPath) {
    throw new Error('cloud features settings path is not configured')
  }
  const next = { ...readSettings(), [CLOUD_FEATURES_SETTING_KEY]: enabled }
  writeFileSync(settingsPath, JSON.stringify(next, null, 2))
}
