import { GoogleGenAI } from '@google/genai'
import type { Provider, ProviderAgent, Message } from '../../core/ports/ai-provider'

class GeminiAgent implements ProviderAgent {
  readonly capabilities = { readsLocalSource: false }
  private client: GoogleGenAI

  constructor(apiKey: string, private model = 'gemini-2.0-flash') {
    this.client = new GoogleGenAI({ apiKey })
  }

  async chatStream(
    systemPrompt: string,
    messages: Message[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = this.client.chats.create({
      model: this.model,
      config: { systemInstruction: systemPrompt },
      history,
    })

    const stream = await chat.sendMessageStream({ message: lastMessage.content })

    let fullText = ''
    for await (const chunk of stream) {
      // 中断要求が来たら消費を止めて抜ける(SDKがHTTP中断に未対応のため自前で打ち切る)
      if (signal?.aborted) throw signal.reason ?? new Error('中断されました')
      const text = chunk.text ?? ''
      onChunk(text)
      fullText += text
    }

    return fullText
  }
}

export class GeminiProvider implements Provider {
  readonly requiresApiKey = true
  setup(apiKey?: string): ProviderAgent {
    if (!apiKey) throw new Error('Gemini にはAPIキーが必要です')
    return new GeminiAgent(apiKey)
  }
}
