import { describe, it, expect } from 'vitest'
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

describe('analyze', () => {
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
    const s = seed()
    await analyze(recordingProvider().provider, s, noopHandlers)

    const { provider, calls } = recordingProvider()
    await analyze(provider, s, noopHandlers)

    const aCall = calls.find((c) => c.system.includes('Aの力'))!
    const bCall = calls.find((c) => c.system.includes('Bの力'))!
    expect(aCall.user).toContain('A所感')
    expect(aCall.user).not.toContain('B所感')
    expect(bCall.user).toContain('B所感')
    expect(bCall.user).not.toContain('A所感')
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
