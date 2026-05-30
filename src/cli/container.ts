import { resolveProvider, PROVIDER_NAMES, type ProviderName } from '../adapters/ai/registry'
import { getStorage, type StorageName } from '../adapters/storage/registry'
import type { ProviderAgent } from '../core/ports/ai-provider'
import type { Storage } from '../core/ports/storage'

export { PROVIDER_NAMES, type ProviderName }

export type Container = {
  storage: Storage
  buildProvider: () => ProviderAgent
}

export function buildContainer(storageName: StorageName = 'yaml'): Container {
  const storage = getStorage(storageName)

  return {
    storage,
    buildProvider: () => resolveProvider(storage),
  }
}
