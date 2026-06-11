import { describe, it, expect } from 'vitest'
import { formatRecap } from './format'
import type { Session } from '../core/ports/storage'

const session = (id: number, user: string, assistant: string): Session => ({
  id,
  createdAt: '2026-06-11T00:00:00.000Z',
  messages: [
    { role: 'user', content: user },
    { role: 'assistant', content: assistant },
  ],
})

describe('formatRecap', () => {
  it('空なら空文字を返す', () => {
    expect(formatRecap([])).toBe('')
  })

  it('役割をあなた/コーチに置き換える', () => {
    expect(formatRecap([session(1, 'こんにちは', 'どうも')])).toBe('あなた: こんにちは\nコーチ: どうも')
  })

  it('往復どうしは空行で区切る', () => {
    const out = formatRecap([session(1, 'A', 'B'), session(2, 'C', 'D')])
    expect(out).toBe('あなた: A\nコーチ: B\n\nあなた: C\nコーチ: D')
  })
})
