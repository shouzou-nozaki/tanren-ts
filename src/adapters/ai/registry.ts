import type { Provider, ProviderAgent } from '../../core/ports/ai-provider'
import type { Storage } from '../../core/ports/storage'
import { GeminiProvider } from './gemini'

export const PROVIDER_NAMES = ['gemini'] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

// configキーの命名規約はここに集約する(書く側=setup / 読む側=resolveProvider で共有)
const PROVIDER_KEY = 'provider'
const apiKeyName = (name: ProviderName) => `${name}_api_key`

class ProviderRegistry {
  private static instance: ProviderRegistry
  private providers = new Map<ProviderName, Provider>([
    ['gemini', new GeminiProvider()],
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

// 選択中プロバイダーをstorageへ保存する
export function saveProviderConfig(storage: Storage, name: ProviderName, apiKey: string): void {
  storage.setConfig(PROVIDER_KEY, name)
  storage.setConfig(apiKeyName(name), apiKey)
}

// storageの設定から実行可能なProviderAgentを組み立てる
export function resolveProvider(storage: Storage): ProviderAgent {
  const name = (storage.getConfig(PROVIDER_KEY) ?? 'gemini') as ProviderName
  const apiKey = storage.getConfig(apiKeyName(name))
  if (!apiKey) throw new Error('APIキーが設定されていません。先に tanren setup を実行してください。')
  return getProvider(name).setup(apiKey)
}
