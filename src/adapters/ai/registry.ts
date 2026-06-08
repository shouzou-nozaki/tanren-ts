import type { Provider, ProviderAgent } from '../../core/ports/ai-provider'
import type { ConfigStore } from '../../core/ports/storage'
import { GeminiProvider } from './gemini'
import { ClaudeProvider } from './claude'

export const PROVIDER_NAMES = ['gemini', 'claude'] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

// プロバイダー未設定時の既定値(設定知識なので解決ロジックから分離する)
const DEFAULT_PROVIDER: ProviderName = 'gemini'

const PROVIDER_KEY = 'provider'
const apiKeyName = (name: ProviderName) => `${name}_api_key`

// APIキーが必要なプロバイダー(未掲載はログイン等の自前認証を使う)
const API_KEY_PROVIDERS = new Set<ProviderName>(['gemini'])

export function requiresApiKey(name: ProviderName): boolean {
  return API_KEY_PROVIDERS.has(name)
}

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
  const name = (storage.getConfig(PROVIDER_KEY) ?? DEFAULT_PROVIDER) as ProviderName
  const provider = getProvider(name)

  if (!requiresApiKey(name)) return provider.setup()

  const apiKey = storage.getConfig(apiKeyName(name))
  if (!apiKey) throw new Error('APIキーが設定されていません。先に tanren setup を実行してください。')
  return provider.setup(apiKey)
}
