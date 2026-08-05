import { describe, expect, it } from 'vitest'
import {
  compareGgufFileName,
  ggufModelApiId,
  normalizeGgufRelativeId,
  pickGgufModel,
  sortGgufModelRefs,
} from '../src/gguf-models'

describe('sortGgufModelRefs', () => {
  it('sorts by basename code points, not directory order', () => {
    const sorted = sortGgufModelRefs([
      { id: 'z/model-b.gguf', fileName: 'model-b.gguf' },
      { id: 'model-a.gguf', fileName: 'model-a.gguf' },
      { id: 'model-c.gguf', fileName: 'model-c.gguf' },
    ])
    expect(sorted.map((m) => m.fileName)).toEqual([
      'model-a.gguf',
      'model-b.gguf',
      'model-c.gguf',
    ])
  })
})

describe('pickGgufModel', () => {
  const models = sortGgufModelRefs([
    { id: 'beta.gguf', fileName: 'beta.gguf' },
    { id: 'alpha.gguf', fileName: 'alpha.gguf' },
  ])

  it('picks sort-first when nothing selected', () => {
    expect(pickGgufModel(models, null)).toEqual({
      id: 'alpha.gguf',
      fileName: 'alpha.gguf',
      missingSelection: false,
    })
  })

  it('keeps an explicit selection when present', () => {
    expect(pickGgufModel(models, 'beta.gguf')).toEqual({
      id: 'beta.gguf',
      fileName: 'beta.gguf',
      missingSelection: false,
    })
  })

  it('falls back and flags when selection is missing', () => {
    expect(pickGgufModel(models, 'gone.gguf')).toEqual({
      id: 'alpha.gguf',
      fileName: 'alpha.gguf',
      missingSelection: true,
    })
  })

  it('returns null when the folder is empty', () => {
    expect(pickGgufModel([], 'x.gguf')).toEqual({
      id: null,
      fileName: null,
      missingSelection: true,
    })
  })
})

describe('helpers', () => {
  it('compares names and strips extension for API id', () => {
    expect(compareGgufFileName('a.gguf', 'b.gguf')).toBeLessThan(0)
    expect(ggufModelApiId('My-Model.Q4_K_M.gguf')).toBe('My-Model.Q4_K_M')
    expect(normalizeGgufRelativeId('.\\subdir\\x.gguf')).toBe('subdir/x.gguf')
  })
})
