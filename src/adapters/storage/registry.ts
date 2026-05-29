import type { Storage } from '../../core/ports/storage'
import { SqliteStorage } from './sqlite'
import { MemoryStorage } from './memory'

export const STORAGE_NAMES = ['sqlite', 'memory'] as const
export type StorageName = (typeof STORAGE_NAMES)[number]

// 選択されたものだけ生成したいので、インスタンスではなくファクトリを登録する
const factories: Record<StorageName, () => Storage> = {
  sqlite: () => new SqliteStorage(),
  memory: () => new MemoryStorage(),
}

export function getStorage(name: StorageName): Storage {
  const make = factories[name]
  if (!make) throw new Error(`未対応のストレージです: ${name}`)
  return make()
}
