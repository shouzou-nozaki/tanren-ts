import { describe, it, expect, afterEach, vi } from 'vitest'
import { analyze } from './analyze'
import { MemoryStorage } from '../../adapters/storage/memory'
import type { ProviderAgent } from '../ports/ai-provider'
import type { Axis } from '../ports/storage'

const AXES: Axis[] = [
  { key: 'a', label: 'Aの力', focus: 'Aを見る' },
  { key: 'b', label: 'Bの力', focus: 'Bを見る' },
]

type Recorded = { system: string; user: string }

function recordingProvider(): { provider: ProviderAgent; calls: Recorded[] } {
  const calls: Recorded[] = []
  const provider: ProviderAgent = {
    async chatStream(system, messages, onChunk) {
      calls.push({ system, user: messages[0].content })
      const out = system.includes('Aの力') ? 'A所感' : 'B所感'
      onChunk(out)
      return out
    },
  }
  return { provider, calls }
}

function seed(axes: Axis[] = AXES): MemoryStorage {
  const s = new MemoryStorage()
  s.saveAxes(axes)
  s.saveSession([
    { role: 'user', content: 'Q1' },
    { role: 'assistant', content: 'A1' },
  ])
  return s
}

const noopHandlers = { onAxisStart: () => {}, onChunk: () => {} }

function at(iso: string): void {
  vi.setSystemTime(new Date(iso))
}

describe('analyze', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('履歴が空なら例外を投げる', async () => {
    const { provider } = recordingProvider()
    const s = new MemoryStorage()
    await expect(analyze(provider, s, noopHandlers)).rejects.toThrow('壁打ち履歴がありません')
  })

  it('軸ごとに専門システムプロンプトのエージェントが順に走る', async () => {
    const { provider, calls } = recordingProvider()
    const s = seed()
    const started: string[] = []
    await analyze(provider, s, { onAxisStart: (l) => started.push(l), onChunk: () => {} })

    expect(started).toEqual(['Aの力', 'Bの力'])
    expect(calls[0].system).toContain('Aの力')
    expect(calls[0].system).toContain('Aを見る')
    expect(calls[1].system).toContain('Bの力')
  })

  it('結果を軸構造で保存し返す', async () => {
    const { provider } = recordingProvider()
    const s = seed()
    const result = await analyze(provider, s, noopHandlers)

    expect(result).toEqual([
      { axis: 'a', summary: 'A所感' },
      { axis: 'b', summary: 'B所感' },
    ])
    expect(s.getLatestReport()?.abilities).toEqual(result)
  })

  it('初回は前回サマリを渡さない', async () => {
    const { provider, calls } = recordingProvider()
    const s = seed()
    await analyze(provider, s, noopHandlers)
    expect(calls.every((c) => !c.user.includes('前回'))).toBe(true)
  })

  it('2回目は同じ軸の前回サマリだけを渡す(軸の混線なし)', async () => {
    vi.useFakeTimers()
    at('2026-01-01T00:00:00Z')
    const s = new MemoryStorage()
    s.saveAxes(AXES)
    s.saveSession([{ role: 'user', content: 'Q1' }])

    at('2026-01-01T01:00:00Z')
    await analyze(recordingProvider().provider, s, noopHandlers)

    at('2026-01-01T02:00:00Z')
    s.saveSession([{ role: 'user', content: 'Q2' }])

    at('2026-01-01T03:00:00Z')
    const { provider, calls } = recordingProvider()
    await analyze(provider, s, noopHandlers)

    const aCall = calls.find((c) => c.system.includes('Aの力'))!
    const bCall = calls.find((c) => c.system.includes('Bの力'))!
    expect(aCall.user).toContain('A所感')
    expect(aCall.user).not.toContain('B所感')
    expect(bCall.user).toContain('B所感')
    expect(bCall.user).not.toContain('A所感')
  })

  it('前回レポート以降の新規セッションだけを解析対象にする', async () => {
    vi.useFakeTimers()
    at('2026-01-01T00:00:00Z')
    const s = new MemoryStorage()
    s.saveAxes([AXES[0]])
    s.saveSession([{ role: 'user', content: '古い質問OLD' }])

    at('2026-01-01T01:00:00Z')
    await analyze(recordingProvider().provider, s, noopHandlers)

    at('2026-01-01T02:00:00Z')
    s.saveSession([{ role: 'user', content: '新しい質問NEW' }])

    at('2026-01-01T03:00:00Z')
    const { provider, calls } = recordingProvider()
    await analyze(provider, s, noopHandlers)

    expect(calls[0].user).toContain('NEW')
    expect(calls[0].user).not.toContain('OLD')
  })

  it('解析対象を最新の上限件数までに絞る', async () => {
    vi.useFakeTimers()
    const s = new MemoryStorage()
    s.saveAxes([AXES[0]])
    for (let i = 0; i < 25; i++) {
      at(`2026-01-01T00:${String(i).padStart(2, '0')}:00Z`)
      s.saveSession([{ role: 'user', content: `S${i}` }])
    }

    at('2026-01-02T00:00:00Z')
    const { provider, calls } = recordingProvider()
    await analyze(provider, s, noopHandlers)

    // 最新20件(S5〜S24)が対象、古い5件(S0〜S4)は除外
    expect(calls[0].user).toContain('S24')
    expect(calls[0].user).toContain('S5')
    expect(calls[0].user).not.toContain('S0')
    expect(calls[0].user).not.toContain('S4')
  })

  it('前回以降に新規セッションが無ければ例外を投げる', async () => {
    vi.useFakeTimers()
    at('2026-01-01T00:00:00Z')
    const s = new MemoryStorage()
    s.saveAxes(AXES)
    s.saveSession([{ role: 'user', content: 'Q' }])

    at('2026-01-01T01:00:00Z')
    await analyze(recordingProvider().provider, s, noopHandlers)

    at('2026-01-01T02:00:00Z')
    await expect(analyze(recordingProvider().provider, s, noopHandlers)).rejects.toThrow(
      '新しい壁打ち'
    )
  })

  it('途中の軸で失敗したら保存しない(原子性)', async () => {
    const failing: ProviderAgent = {
      async chatStream(system, _m, onChunk) {
        if (system.includes('Bの力')) throw new Error('boom')
        onChunk('ok')
        return 'ok'
      },
    }
    const s = seed()
    await expect(analyze(failing, s, noopHandlers)).rejects.toThrow('boom')
    expect(s.getLatestReport()).toBeNull()
  })

  it('storage.getAxes() の軸定義に従う', async () => {
    const { provider } = recordingProvider()
    const s = seed([{ key: 'solo', label: '単一軸', focus: 'x' }])
    const result = await analyze(provider, s, noopHandlers)
    expect(result.map((r) => r.axis)).toEqual(['solo'])
  })
})
