import type { Provider, ProviderAgent } from '../../core/ports/ai-provider'
import type { ConfigStore } from '../../core/ports/storage'
import { GeminiProvider } from './gemini'
import { ClaudeProvider } from './claude'

export const PROVIDER_NAMES = ['gemini', 'claude'] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

const PROVIDER_KEY = 'provider'
const apiKeyName = (name: ProviderName) => `${name}_api_key`

const factories: Record<ProviderName, () => Provider> = {
  gemini: () => new GeminiProvider(),
  claude: () => new ClaudeProvider(),
}

export function getProvider(name: ProviderName): Provider {
  const make = factories[name]
  if (!make) throw new Error(`未対応のプロバイダーです: ${name}`)
  return make()
}

export function isProviderConfigured(storage: ConfigStore): boolean {
  return storage.getConfig(PROVIDER_KEY) !== null
}

export function saveProviderConfig(storage: ConfigStore, name: ProviderName, apiKey?: string): void {
  storage.setConfig(PROVIDER_KEY, name)
  if (apiKey) storage.setConfig(apiKeyName(name), apiKey)
}

export function resolveProvider(storage: ConfigStore): ProviderAgent {
  const name = storage.getConfig(PROVIDER_KEY) as ProviderName | null
  if (!name) throw new Error('プロバイダーが設定されていません。先に tanren setup を実行してください。')
  const provider = getProvider(name)

  if (!provider.requiresApiKey) return provider.setup()

  const apiKey = storage.getConfig(apiKeyName(name))
  if (!apiKey) throw new Error('APIキーが設定されていません。先に tanren setup を実行してください。')
  return provider.setup(apiKey)
}
