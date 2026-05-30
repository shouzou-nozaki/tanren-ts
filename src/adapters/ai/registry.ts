import type { Provider, ProviderAgent } from '../../core/ports/ai-provider'
import type { Storage } from '../../core/ports/storage'
import { GeminiProvider } from './gemini'
import { ClaudeProvider } from './claude'

export const PROVIDER_NAMES = ['gemini', 'claude'] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

const PROVIDER_KEY = 'provider'
const apiKeyName = (name: ProviderName) => `${name}_api_key`

// APIキーが必要なプロバイダー(未掲載はログイン等の自前認証を使う)
const API_KEY_PROVIDERS = new Set<ProviderName>(['gemini'])

export function requiresApiKey(name: ProviderName): boolean {
  return API_KEY_PROVIDERS.has(name)
}

class ProviderRegistry {
  private static instance: ProviderRegistry
  private providers = new Map<ProviderName, Provider>([
    ['gemini', new GeminiProvider()],
    ['claude', new ClaudeProvider()],
  ])

  static getInstance(): ProviderRegistry {
    if (!this.instance) this.instance = new ProviderRegistry()
    return this.instance
  }

  get(name: ProviderName): Provider {
    const provider = this.providers.get(name)
    if (!provider) throw new Error(`未対応のプロバイダーです: ${name}`)
    return provider
  }
}

export function getProvider(name: ProviderName): Provider {
  return ProviderRegistry.getInstance().get(name)
}

export function saveProviderConfig(storage: Storage, name: ProviderName, apiKey?: string): void {
  storage.setConfig(PROVIDER_KEY, name)
  if (apiKey) storage.setConfig(apiKeyName(name), apiKey)
}

export function resolveProvider(storage: Storage): ProviderAgent {
  const name = (storage.getConfig(PROVIDER_KEY) ?? 'gemini') as ProviderName
  const provider = getProvider(name)

  if (!requiresApiKey(name)) return provider.setup()

  const apiKey = storage.getConfig(apiKeyName(name))
  if (!apiKey) throw new Error('APIキーが設定されていません。先に tanren setup を実行してください。')
  return provider.setup(apiKey)
}
