import { describe, it, expect } from 'vitest'
import { buildLocalSlidePptx, extractBullets } from '../src/main/local-page-generate'
import { openPptx } from '@arkoffice/pptx-engine'

describe('local-page-generate', () => {
  it('extractBullets splits lines and strips markers', () => {
    expect(extractBullets('- one\n* two\n3. three')).toEqual(['one', 'two', 'three'])
  })

  it('builds a one-slide pptx from a content brief', async () => {
    const bytes = await buildLocalSlidePptx({
      title: '情報セキュリティの基本',
      brief: 'パスワード管理\nフィッシング対策\n端末の持ち出しルール',
      layout: 'left_text_right_image',
      styleSkill: 'Main background: #F4F6F8\nMain text color: #1A2332\nPrimary accent: #0B3456',
    })
    expect(bytes.byteLength).toBeGreaterThan(1000)
    const opened = await openPptx(bytes)
    expect(opened.deck.slides).toHaveLength(1)
    expect(opened.deck.slides[0]!.elements.length).toBeGreaterThan(2)
  })

  it('builds a cover layout', async () => {
    const bytes = await buildLocalSlidePptx({
      title: '新入社員研修',
      brief: '会社を守る情報セキュリティ',
      layout: 'cover_typography_hero',
    })
    const opened = await openPptx(bytes)
    expect(opened.deck.slides[0]!.elements.length).toBeGreaterThan(2)
  })
})
