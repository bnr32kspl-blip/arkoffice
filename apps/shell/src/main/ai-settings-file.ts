import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import {
  defaultAiSettings,
  resolveAiSettings,
  type AiSettings,
  type LegacyAiSettings,
} from '@arkoffice/ai-provider'

export function readShellAiSettings(): AiSettings {
  const path = join(app.getPath('userData'), 'ai-settings.json')
  try {
    if (existsSync(path)) {
      const stored = JSON.parse(readFileSync(path, 'utf8')) as Partial<AiSettings> & LegacyAiSettings
      return resolveAiSettings(stored, defaultAiSettings())
    }
  } catch {
    /* corrupt → defaults */
  }
  return defaultAiSettings()
}
