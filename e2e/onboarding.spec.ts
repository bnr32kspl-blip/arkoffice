import { test, expect } from '@playwright/test'
import { launchShell, closeAndSaveVideo, screenshotPath } from './helpers'

test.describe('first-run onboarding', () => {
  test('marketing onboarding overlay is not shown on a fresh install', async () => {
    const launched = await launchShell({ videoDir: 'onboarding-removed' })
    const { page } = launched
    try {
      await expect(page.locator('.home-hero')).toBeVisible()
      await expect(page.locator('.onb-overlay')).toHaveCount(0)
      await page.screenshot({ path: screenshotPath('onboarding-removed-home') })
    } finally {
      await closeAndSaveVideo(launched, 'onboarding-removed')
    }
  })
})
