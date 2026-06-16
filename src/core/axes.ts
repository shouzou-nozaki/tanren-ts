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
  {
    key: 'review',
    label: 'コードレビュー力',
    focus:
      '指摘の的確さ・優先順位づけ・伝え方に注目してください。重要な問題と些末な指摘を切り分けられているかを評価します。',
  },
]
