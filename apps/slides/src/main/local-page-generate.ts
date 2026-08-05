/**
 * Local (air-gapped) one-page slide builder for generate_deck.
 * Produces a single-slide PPTX from title/brief/layout/style without cloud CLI.
 */
import {
  addElement,
  createBlankPptx,
  openPptx,
  savePptx,
  type Paragraph,
} from '@arkoffice/pptx-engine'
import { EMU_PER_PX_96 } from '@arkoffice/pptx-render'

export type LocalPageGenerateArgs = {
  title?: string
  brief: string
  layout?: string
  styleSkill?: string
  width?: number
  height?: number
}

type Palette = {
  bg: string
  text: string
  accent: string
  card: string
}

const DEFAULT_PALETTE: Palette = {
  bg: '#F4F6F8',
  text: '#1A2332',
  accent: '#0B3456',
  card: '#FFFFFF',
}

function pxToEmu(px: number, canvasW: number, deckCx: number): number {
  const scale = canvasW / (deckCx / EMU_PER_PX_96)
  return Math.round((px / scale) * EMU_PER_PX_96)
}

function parsePalette(styleSkill?: string): Palette {
  const p = { ...DEFAULT_PALETTE }
  if (!styleSkill) return p
  const pick = (label: RegExp, fallback: string): string => {
    const m = styleSkill.match(label)
    return m?.[1] ? `#${m[1].replace(/^#/, '').slice(0, 6)}` : fallback
  }
  p.bg = pick(/(?:Main background|content|cover)\s*[:=]\s*(#[0-9A-Fa-f]{6})/i, p.bg)
  p.text = pick(/(?:Main text color|text color)\s*[:=]\s*(#[0-9A-Fa-f]{6})/i, p.text)
  p.accent = pick(/(?:Primary accent|accent)\s*[:=]\s*(#[0-9A-Fa-f]{6})/i, p.accent)
  p.card = pick(/(?:Card background)\s*[:=]\s*(#[0-9A-Fa-f]{6})/i, p.card)
  // Prefer explicit content-page background when present
  const contentBg = styleSkill.match(/content\s*[:=]\s*(#[0-9A-Fa-f]{6})/i)
  if (contentBg?.[1]) p.bg = contentBg[1]
  return p
}

/** Split a free-form brief into short bullet-like lines. */
export function extractBullets(brief: string, max = 6): string[] {
  const lines = brief
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•\-*–—\d.)]+/, '').trim())
    .filter((l) => l.length > 0)
  if (lines.length >= 2) return lines.slice(0, max)
  // Sentence split fallback
  const parts = brief
    .split(/[。．.!？?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
  if (parts.length >= 2) return parts.slice(0, max)
  const trimmed = brief.trim()
  return trimmed ? [trimmed.slice(0, 220)] : []
}

function para(
  text: string,
  opts: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'center' | 'right' } = {},
): Paragraph {
  return {
    runs: [
      {
        text,
        ...(opts.size != null ? { fontSize: opts.size } : {}),
        ...(opts.bold ? { bold: true } : {}),
        ...(opts.color ? { color: opts.color } : {}),
      },
    ],
    ...(opts.align ? { align: opts.align } : {}),
  }
}

function isCover(layout: string, pageHint?: string): boolean {
  const s = `${layout} ${pageHint ?? ''}`.toLowerCase()
  return /cover|title|closing|thank/.test(s)
}

function isThreeCol(layout: string): boolean {
  return /three_column|3.?col|cards/i.test(layout)
}

function isBigNumber(layout: string): boolean {
  return /hero_big_number|kpi|big.?number/i.test(layout)
}

function pickBigNumber(brief: string): string | null {
  const m = brief.match(/(?:¥|\$|€)?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?|\d+%/)
  return m?.[0] ?? null
}

/**
 * Build a single-slide PPTX buffer suitable for the cloudpptx: landing path.
 */
export async function buildLocalSlidePptx(args: LocalPageGenerateArgs): Promise<Uint8Array> {
  const title = (args.title ?? '').trim() || 'Untitled'
  const brief = String(args.brief ?? '').trim()
  const layout = String(args.layout ?? 'content')
  const palette = parsePalette(args.styleSkill)
  const canvasW = args.width && args.width > 0 ? args.width : 1280
  const canvasH = args.height && args.height > 0 ? args.height : 720

  const opened = await openPptx(await createBlankPptx())
  const slide = opened.deck.slides[0]
  if (!slide) throw new Error('blank pptx has no slide')
  const deckCx = opened.deck.size.cx
  const toEmu = (px: number) => pxToEmu(px, canvasW, deckCx)

  // Full-bleed background
  addElement(slide, {
    kind: 'rect',
    offset: { x: 0, y: 0, cx: toEmu(canvasW), cy: toEmu(canvasH) },
    fillColor: palette.bg,
  })

  if (isCover(layout, title)) {
    // Accent bar
    addElement(slide, {
      kind: 'rect',
      offset: { x: 0, y: toEmu(canvasH - 48), cx: toEmu(canvasW), cy: toEmu(48) },
      fillColor: palette.accent,
    })
    addElement(slide, {
      kind: 'textbox',
      offset: { x: toEmu(80), y: toEmu(220), cx: toEmu(1120), cy: toEmu(160) },
      paragraphs: [para(title, { size: 40, bold: true, color: palette.text, align: 'center' })],
    })
    const sub = extractBullets(brief, 2).join(' · ')
    if (sub) {
      addElement(slide, {
        kind: 'textbox',
        offset: { x: toEmu(120), y: toEmu(400), cx: toEmu(1040), cy: toEmu(80) },
        paragraphs: [para(sub.slice(0, 180), { size: 18, color: palette.text, align: 'center' })],
      })
    }
  } else if (isBigNumber(layout) && pickBigNumber(brief)) {
    const num = pickBigNumber(brief)!
    addElement(slide, {
      kind: 'textbox',
      offset: { x: toEmu(80), y: toEmu(60), cx: toEmu(1120), cy: toEmu(60) },
      paragraphs: [para(title, { size: 22, bold: true, color: palette.accent })],
    })
    addElement(slide, {
      kind: 'textbox',
      offset: { x: toEmu(80), y: toEmu(200), cx: toEmu(1120), cy: toEmu(180) },
      paragraphs: [para(num, { size: 72, bold: true, color: palette.text, align: 'center' })],
    })
    const rest = extractBullets(brief, 3).filter((b) => !b.includes(num))
    if (rest.length) {
      addElement(slide, {
        kind: 'textbox',
        offset: { x: toEmu(160), y: toEmu(420), cx: toEmu(960), cy: toEmu(200) },
        paragraphs: rest.map((b) => para(b, { size: 16, color: palette.text, align: 'center' })),
      })
    }
  } else if (isThreeCol(layout)) {
    addElement(slide, {
      kind: 'textbox',
      offset: { x: toEmu(64), y: toEmu(48), cx: toEmu(1152), cy: toEmu(64) },
      paragraphs: [para(title, { size: 28, bold: true, color: palette.text })],
    })
    const bullets = extractBullets(brief, 3)
    while (bullets.length < 3) bullets.push('')
    const cardW = 360
    const gap = 24
    const startX = 64
    for (let i = 0; i < 3; i++) {
      const x = startX + i * (cardW + gap)
      addElement(slide, {
        kind: 'roundRect',
        offset: { x: toEmu(x), y: toEmu(140), cx: toEmu(cardW), cy: toEmu(480) },
        fillColor: palette.card,
        stroke: { color: palette.accent, widthEmu: Math.round(1.25 * 12700) },
      })
      addElement(slide, {
        kind: 'rect',
        offset: { x: toEmu(x), y: toEmu(140), cx: toEmu(8), cy: toEmu(480) },
        fillColor: palette.accent,
      })
      const body = bullets[i] || '—'
      addElement(slide, {
        kind: 'textbox',
        offset: { x: toEmu(x + 28), y: toEmu(180), cx: toEmu(cardW - 48), cy: toEmu(400) },
        paragraphs: [
          para(`${i + 1}`, { size: 20, bold: true, color: palette.accent }),
          para(body, { size: 16, color: palette.text }),
        ],
      })
    }
  } else {
    // Default content: title + bullets
    addElement(slide, {
      kind: 'rect',
      offset: { x: 0, y: 0, cx: toEmu(12), cy: toEmu(canvasH) },
      fillColor: palette.accent,
    })
    addElement(slide, {
      kind: 'textbox',
      offset: { x: toEmu(72), y: toEmu(56), cx: toEmu(1140), cy: toEmu(80) },
      paragraphs: [para(title, { size: 30, bold: true, color: palette.text })],
    })
    const bullets = extractBullets(brief, 6)
    addElement(slide, {
      kind: 'textbox',
      offset: { x: toEmu(72), y: toEmu(160), cx: toEmu(1140), cy: toEmu(500) },
      paragraphs: bullets.map((b) => para(`• ${b}`, { size: 18, color: palette.text })),
    })
  }

  return savePptx(opened)
}
