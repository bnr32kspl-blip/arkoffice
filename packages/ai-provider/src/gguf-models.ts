/**
 * Pure helpers for GGUF discovery / selection (no filesystem I/O).
 * Scanning lives in the Electron main process; this module owns sort + pick rules.
 */

/** Relative id under the models directory (e.g. `foo.gguf` or `subdir/bar.gguf`) */
export type GgufModelId = string

export interface GgufModelRef {
  /** Relative path from the models root, using `/` separators */
  id: GgufModelId
  /** Basename including `.gguf` */
  fileName: string
}

/** Locale-independent basename sort (Unicode code point ascending). */
export function compareGgufFileName(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function sortGgufModelRefs<T extends GgufModelRef>(models: T[]): T[] {
  return [...models].sort((x, y) => {
    const byName = compareGgufFileName(x.fileName, y.fileName)
    if (byName !== 0) return byName
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0
  })
}

/** Stem used as llama-server / OpenAI `model` id (basename without extension). */
export function ggufModelApiId(fileName: string): string {
  return fileName.replace(/\.gguf$/i, '')
}

/**
 * Pick the effective model id: explicit selection if still present, else sort-first.
 * `missingSelection` is true when a stored selection was set but no longer on disk.
 */
export function pickGgufModel(
  models: GgufModelRef[],
  selectedModelFile: string | null | undefined,
): { id: string | null; fileName: string | null; missingSelection: boolean } {
  const sorted = sortGgufModelRefs(models)
  if (sorted.length === 0) {
    return {
      id: null,
      fileName: null,
      missingSelection: Boolean(selectedModelFile && selectedModelFile.trim()),
    }
  }

  const wanted = selectedModelFile?.trim() || null
  if (wanted) {
    const match = sorted.find(
      (m) => m.id === wanted || m.fileName === wanted || m.id.replace(/\\/g, '/') === wanted.replace(/\\/g, '/'),
    )
    if (match) {
      return { id: match.id, fileName: match.fileName, missingSelection: false }
    }
    const fallback = sorted[0]!
    return { id: fallback.id, fileName: fallback.fileName, missingSelection: true }
  }

  const first = sorted[0]!
  return { id: first.id, fileName: first.fileName, missingSelection: false }
}

/** Normalize a relative models path to `/` separators without leading `./` */
export function normalizeGgufRelativeId(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/^\.\//, '')
}
