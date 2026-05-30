import type { Storage } from '../../core/ports/storage'
import { YamlStorage } from './yaml'
import { MemoryStorage } from './memory'

export const STORAGE_NAMES = ['yaml', 'memory'] as const
export type StorageName = (typeof STORAGE_NAMES)[number]

const factories: Record<StorageName, () => Storage> = {
  yaml: () => new YamlStorage(),
  memory: () => new MemoryStorage(),
}

export function getStorage(name: StorageName): Storage {
  const make = factories[name]
  if (!make) throw new Error(`未対応のストレージです: ${name}`)
  return make()
}
