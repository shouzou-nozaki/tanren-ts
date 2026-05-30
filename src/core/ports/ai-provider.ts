export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export interface ProviderAgent {
  chatStream(
    systemPrompt: string,
    messages: Message[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string>
}

export interface Provider {
  setup(apiKey?: string): ProviderAgent
}
