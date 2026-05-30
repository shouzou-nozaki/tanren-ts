import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Provider, ProviderAgent, Message } from '../../core/ports/ai-provider'

function buildPrompt(messages: Message[]): string {
  if (messages.length <= 1) return messages[messages.length - 1]?.content ?? ''
  const history = messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'コーチ'}: ${m.content}`)
    .join('\n')
  const last = messages[messages.length - 1].content
  return `これまでの会話:\n${history}\n\n新しい発言:\n${last}`
}

class ClaudeAgent implements ProviderAgent {
  async chatStream(
    systemPrompt: string,
    messages: Message[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const controller = new AbortController()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    const stream = query({
      prompt: buildPrompt(messages),
      options: {
        systemPrompt,
        allowedTools: [],
        maxTurns: 1,
        includePartialMessages: true,
        abortController: controller,
      },
    })

    let fullText = ''
    for await (const msg of stream) {
      if (signal?.aborted) throw signal.reason ?? new Error('中断されました')

      if (msg.type === 'stream_event') {
        const event = msg.event
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onChunk(event.delta.text)
          fullText += event.delta.text
        }
      } else if (msg.type === 'result' && msg.subtype !== 'success') {
        throw new Error(`Claude応答エラー: ${msg.subtype}`)
      }
    }

    return fullText
  }
}

export class ClaudeProvider implements Provider {
  setup(): ProviderAgent {
    return new ClaudeAgent()
  }
}
