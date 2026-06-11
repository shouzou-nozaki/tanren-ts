import type { AxisStore, Session } from '../core/ports/storage'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}

// 過去の往復を会話ログとして整形する。装飾は呼び出し側に委ねる
export function formatRecap(sessions: Session[]): string {
  return sessions
    .map((s) =>
      s.messages.map((m) => `${m.role === 'user' ? 'あなた' : 'コーチ'}: ${m.content}`).join('\n')
    )
    .join('\n\n')
}

// 軸キー→ラベルの解決子。現存しない過去軸はキーをそのまま返す
export function resolveAxisLabel(storage: AxisStore): (axis: string) => string {
  const labels = new Map(storage.getAxes().map((a) => [a.key, a.label]))
  return (axis) => labels.get(axis) ?? axis
}
