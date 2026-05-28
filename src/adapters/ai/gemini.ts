import { GoogleGenAI } from '@google/genai'
import type { AiProvider, Message } from '../../core/ports/ai-provider'

export class GeminiProvider implements AiProvider {
  private client: GoogleGenAI

  constructor(apiKey: string, private model = 'gemini-2.0-flash') {
    this.client = new GoogleGenAI({ apiKey })
  }

  async chatStream(
    systemPrompt: string,
    messages: Message[],
    onChunk: (text: string) => void
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
      const text = chunk.text ?? ''
      onChunk(text)
      fullText += text
    }

    return fullText
  }
}
