import type { Axis } from './ports/storage'

export const DEFAULT_AXES: Axis[] = [
  {
    key: 'decision',
    label: '技術的判断・トレードオフ思考',
    focus:
      '選択肢を比較し、根拠を持って意思決定する力に注目してください。トレードオフの言語化・判断の一貫性・前提の置き方を評価します。',
  },
  {
    key: 'design',
    label: '設計力・アーキテクチャ',
    focus:
      '責務分割・抽象化・依存方向・拡張性など、構造を考える力に注目してください。',
  },
]
