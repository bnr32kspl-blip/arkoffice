import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  configureCloudFeatures,
  isCloudFeaturesEnabled,
  setCloudFeaturesEnabled,
} from '../src/cloud-features'
import { isWebSearchEnabled } from '../src/index'

describe('cloud features setting', () => {
  let dir: string
  let path: string
  const prevCloud = process.env.ARKOFFICE_CLOUD_FEATURES
  const prevSearch = process.env.ARKOFFICE_ALLOW_WEB_SEARCH

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cloud-features-'))
    path = join(dir, 'app-settings.json')
    configureCloudFeatures(path)
    delete process.env.ARKOFFICE_CLOUD_FEATURES
    delete process.env.ARKOFFICE_ALLOW_WEB_SEARCH
  })

  afterEach(() => {
    if (prevCloud === undefined) delete process.env.ARKOFFICE_CLOUD_FEATURES
    else process.env.ARKOFFICE_CLOUD_FEATURES = prevCloud
    if (prevSearch === undefined) delete process.env.ARKOFFICE_ALLOW_WEB_SEARCH
    else process.env.ARKOFFICE_ALLOW_WEB_SEARCH = prevSearch
    rmSync(dir, { recursive: true, force: true })
  })

  it('defaults to off when the settings file is missing', () => {
    expect(isCloudFeaturesEnabled()).toBe(false)
    expect(isWebSearchEnabled()).toBe(false)
  })

  it('reads the persisted toggle', () => {
    writeFileSync(path, JSON.stringify({ cloudFeaturesEnabled: true }))
    expect(isCloudFeaturesEnabled()).toBe(true)
    expect(isWebSearchEnabled()).toBe(true)
  })

  it('persists setCloudFeaturesEnabled', () => {
    setCloudFeaturesEnabled(true)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ cloudFeaturesEnabled: true })
    setCloudFeaturesEnabled(false)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ cloudFeaturesEnabled: false })
  })

  it('respects ARKOFFICE_CLOUD_FEATURES env overrides', () => {
    writeFileSync(path, JSON.stringify({ cloudFeaturesEnabled: true }))
    process.env.ARKOFFICE_CLOUD_FEATURES = '0'
    expect(isCloudFeaturesEnabled()).toBe(false)
    process.env.ARKOFFICE_CLOUD_FEATURES = '1'
    writeFileSync(path, JSON.stringify({ cloudFeaturesEnabled: false }))
    expect(isCloudFeaturesEnabled()).toBe(true)
  })

  it('forces search on with ARKOFFICE_ALLOW_WEB_SEARCH=1', () => {
    expect(isCloudFeaturesEnabled()).toBe(false)
    process.env.ARKOFFICE_ALLOW_WEB_SEARCH = '1'
    expect(isWebSearchEnabled()).toBe(true)
  })

  it('forces search off with ARKOFFICE_ALLOW_WEB_SEARCH=0', () => {
    setCloudFeaturesEnabled(true)
    process.env.ARKOFFICE_ALLOW_WEB_SEARCH = '0'
    expect(isWebSearchEnabled()).toBe(false)
  })
})
