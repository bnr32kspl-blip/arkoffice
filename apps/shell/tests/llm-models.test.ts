import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { getModelsDirStatus, scanGgufModels } from '../src/main/llm-models'

describe('scanGgufModels', () => {
  let root = ''

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
    root = ''
  })

  it('finds root and one-level nested gguf files, sorted by basename', () => {
    root = mkdtempSync(join(tmpdir(), 'arkoffice-models-'))
    writeFileSync(join(root, 'zeta.gguf'), 'x')
    writeFileSync(join(root, 'alpha.gguf'), 'x')
    mkdirSync(join(root, 'pack'))
    writeFileSync(join(root, 'pack', 'beta.gguf'), 'x')
    mkdirSync(join(root, 'pack', 'deep'))
    writeFileSync(join(root, 'pack', 'deep', 'ignored.gguf'), 'x')
    writeFileSync(join(root, 'notes.txt'), 'nope')

    const models = scanGgufModels(root)
    expect(models.map((m) => m.id)).toEqual(['alpha.gguf', 'pack/beta.gguf', 'zeta.gguf'])
    expect(models.every((m) => m.sizeBytes > 0)).toBe(true)
  })

  it('creates the models directory when missing', () => {
    root = mkdtempSync(join(tmpdir(), 'arkoffice-models-parent-'))
    const modelsPath = join(root, 'models')
    process.env.ARKOFFICE_MODELS_DIR = modelsPath
    try {
      const status = getModelsDirStatus(null)
      expect(status.path).toBe(modelsPath)
      expect(status.exists).toBe(true)
      expect(status.created).toBe(true)
      expect(status.models).toEqual([])
    } finally {
      delete process.env.ARKOFFICE_MODELS_DIR
    }
  })
})
