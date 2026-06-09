import { describe, it, expect } from 'vitest'
import { isProviderConfigured, saveProviderConfig, getProvider } from './registry'
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

describe('requiresApiKey(Providerの自己申告)', () => {
  it('Gemini はキーが要る、Claude は要らない', () => {
    expect(getProvider('gemini').requiresApiKey).toBe(true)
    expect(getProvider('claude').requiresApiKey).toBe(false)
  })
})
