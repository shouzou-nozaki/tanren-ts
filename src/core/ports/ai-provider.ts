export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export interface ProviderCapabilities {
  readonly readsLocalSource: boolean
}

export interface ProviderAgent {
  readonly capabilities: ProviderCapabilities
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
