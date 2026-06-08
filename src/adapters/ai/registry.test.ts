import { describe, it, expect } from 'vitest'
import { isProviderConfigured, saveProviderConfig, requiresApiKey } from './registry'
import { MemoryStorage } from '../storage/memory'

describe('isProviderConfigured', () => {
  it('未設定なら false', () => {
    expect(isProviderConfigured(new MemoryStorage())).toBe(false)
  })

  it('プロバイダ設定後は true', () => {
    const s = new MemoryStorage()
    saveProviderConfig(s, 'claude')
    expect(isProviderConfigured(s)).toBe(true)
  })
})

describe('requiresApiKey', () => {
  it('各プロバイダーの自己申告に従う', () => {
    expect(requiresApiKey('gemini')).toBe(true)
    expect(requiresApiKey('claude')).toBe(false)
  })
})
