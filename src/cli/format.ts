import type { AxisStore } from '../core/ports/storage'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}

// 軸キー→ラベルの解決子。現存しない過去軸はキーをそのまま返す
export function resolveAxisLabel(storage: AxisStore): (axis: string) => string {
  const labels = new Map(storage.getAxes().map((a) => [a.key, a.label]))
  return (axis) => labels.get(axis) ?? axis
}
