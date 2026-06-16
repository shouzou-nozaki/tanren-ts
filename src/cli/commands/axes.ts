import chalk from 'chalk'
import { input, confirm } from '@inquirer/prompts'
import type { Axis, AxisStore } from '../../core/ports/storage'
import { DEFAULT_AXES } from '../../core/axes'

const MAX_AXES = 5

export async function axesCommand(storage: AxisStore): Promise<void> {
  console.log(chalk.cyan('\n🎯 伸ばす能力（軸）の設定\n'))
  console.log(chalk.gray('能力名を空にするとその軸を削除します。focus はその軸で何を見るかの観点です。\n'))

  const current = storage.getAxes()
  const result: Axis[] = []

  // 既存の軸を1つずつ編集する。key は履歴の連続性のため維持する
  for (const axis of current) {
    const label = (await input({ message: '能力名', default: axis.label })).trim()
    if (!label) {
      console.log(chalk.gray(`  （「${axis.label}」を削除）`))
      continue
    }
    const focus = (await input({ message: '評価観点（focus）', default: axis.focus })).trim()
    result.push({ key: axis.key, label, focus })
  }

  // 上限まで追加できる
  while (result.length < MAX_AXES) {
    if (!(await confirm({ message: '能力を追加する？', default: false }))) break
    const label = (await input({ message: '能力名' })).trim()
    if (!label) break
    const focus = (await input({ message: '評価観点（focus）' })).trim()
    result.push({ key: generateKey(), label, focus })
  }

  // 全部消したらデフォルトに戻す
  if (result.length === 0) {
    storage.saveAxes(DEFAULT_AXES)
    console.log(chalk.yellow('\n軸が空になったため、デフォルトに戻しました。\n'))
    return
  }

  storage.saveAxes(result)
  console.log(chalk.green(`\n✅ ${result.length}件の能力を保存しました`))
  for (const a of result) console.log(`  - ${a.label}`)
  console.log()
}

// 新規軸の安定 key。履歴照合に使うだけなので不透明で良い
function generateKey(): string {
  return `axis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
