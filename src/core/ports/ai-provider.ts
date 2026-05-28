export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export interface AiProvider {
  chatStream(
    systemPrompt: string,
    messages: Message[],
    onChunk: (text: string) => void
  ): Promise<string>
}
