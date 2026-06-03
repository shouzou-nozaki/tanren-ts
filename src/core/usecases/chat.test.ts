import { describe, it, expect } from 'vitest'
import { chat } from './chat'
import { MemoryStorage } from '../../adapters/storage/memory'
import type { ProviderAgent } from '../ports/ai-provider'
import type { Axis } from '../ports/storage'

const AXES: Axis[] = [
  { key: 'a', label: 'Aの力', focus: 'Aの観点を掘る' },
  { key: 'b', label: 'Bの力', focus: 'Bの観点を掘る' },
]

function recordingProvider(): { provider: ProviderAgent; calls: { system: string }[] } {
  const calls: { system: string }[] = []
  const provider: ProviderAgent = {
    async chatStream(system, _messages, onChunk) {
      calls.push({ system })
      onChunk('応答')
      return '応答'
    },
  }
  return { provider, calls }
}

describe('chat', () => {
  it('軸定義をコーチのシステムプロンプトに織り込む', async () => {
    const s = new MemoryStorage()
    s.saveAxes(AXES)
    const { provider, calls } = recordingProvider()

    await chat('質問', provider, s, () => {})

    expect(calls[0].system).toContain('Aの力')
    expect(calls[0].system).toContain('Aの観点を掘る')
    expect(calls[0].system).toContain('Bの力')
  })

  it('やり取りをセッションとして保存する', async () => {
    const s = new MemoryStorage()
    s.saveAxes(AXES)
    const { provider } = recordingProvider()

    await chat('質問', provider, s, () => {})

    const sessions = s.getAllSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].messages).toEqual([
      { role: 'user', content: '質問' },
      { role: 'assistant', content: '応答' },
    ])
  })
})
