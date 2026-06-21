import { describe, it, expect } from 'vitest'
import { chat } from './chat'
import { MemoryStorage } from '../../adapters/storage/memory'
import type { Message, ProviderAgent } from '../ports/ai-provider'
import type { Axis } from '../ports/storage'

const AXES: Axis[] = [
  { key: 'a', label: 'Aの力', focus: 'Aの観点を掘る' },
  { key: 'b', label: 'Bの力', focus: 'Bの観点を掘る' },
]

function recordingProvider(): { provider: ProviderAgent; calls: { system: string }[] } {
  const calls: { system: string }[] = []
  const provider: ProviderAgent = {
    capabilities: { readsLocalSource: false },
    async chatStream(system, _messages, onChunk) {
      calls.push({ system })
      onChunk('応答')
      return '応答'
    },
  }
  return { provider, calls }
}

describe('chat', () => {
  it('フォーカス軸をコーチのシステムプロンプトに織り込む', async () => {
    const s = new MemoryStorage()
    const { provider, calls } = recordingProvider()

    await chat('質問', provider, s, AXES[0], () => {})

    expect(calls[0].system).toContain('Aの力')
    expect(calls[0].system).toContain('Aの観点を掘る')
    expect(calls[0].system).not.toContain('Bの力')
  })

  it('セッションに焦点軸の key を記録する', async () => {
    const s = new MemoryStorage()
    const { provider } = recordingProvider()

    await chat('質問', provider, s, AXES[0], () => {})

    expect(s.getAllSessions()[0].axisKey).toBe('a')
  })

  it('同じ軸の会話だけを文脈にする', async () => {
    const s = new MemoryStorage()
    s.saveSession([{ role: 'user', content: 'B軸の話' }], 'b') // 別軸の履歴
    const seen: Message[][] = []
    const provider: ProviderAgent = {
      capabilities: { readsLocalSource: false },
      async chatStream(_system, messages, onChunk) {
        seen.push(messages)
        onChunk('応答')
        return '応答'
      },
    }

    await chat('A軸の質問', provider, s, AXES[0], () => {})

    const sent = seen[0].map((m) => m.content).join('\n')
    expect(sent).toContain('A軸の質問')
    expect(sent).not.toContain('B軸の話') // 別軸の履歴は混ざらない
  })

  it('やり取りをセッションとして保存する', async () => {
    const s = new MemoryStorage()
    const { provider } = recordingProvider()

    await chat('質問', provider, s, AXES[0], () => {})

    const sessions = s.getAllSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].messages).toEqual([
      { role: 'user', content: '質問' },
      { role: 'assistant', content: '応答' },
    ])
  })
})
