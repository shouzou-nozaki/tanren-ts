import chalk from 'chalk'
import { input, confirm, select } from '@inquirer/prompts'
import type { Axis, AxisStore } from '../../core/ports/storage'
import { DEFAULT_AXES } from '../../core/axes'

const MAX_AXES = 5

export async function axesCommand(storage: AxisStore): Promise<void> {
  console.log(chalk.cyan('\n🎯 伸ばす能力（軸）の設定'))
  console.log(chalk.gray('「保存して終了」で確定。Ctrl+C で保存せず抜けます。'))

  // 作業用コピー。保存は「保存して終了」を選んだときだけ反映する
  let axes: Axis[] = storage.getAxes().map((a) => ({ ...a }))

  while (true) {
    printAxes(axes)
    const action = await select({
      message: 'どうしますか？',
      choices: [
        { name: '軸を編集する', value: 'edit' },
        { name: '軸を追加する', value: 'add' },
        { name: '軸を削除する', value: 'remove' },
        { name: 'デフォルトに戻す', value: 'reset' },
        { name: '保存して終了', value: 'save' },
      ],
    })

    if (action === 'save') {
      const toSave = axes.length > 0 ? axes : DEFAULT_AXES
      storage.saveAxes(toSave)
      if (axes.length === 0) console.log(chalk.yellow('\n軸が空のため、デフォルトを保存しました。'))
      console.log(chalk.green(`\n✅ ${toSave.length}件の能力を保存しました\n`))
      return
    }

    if (action === 'reset') {
      if (await confirm({ message: '現在の編集を破棄してデフォルトに戻しますか？', default: false })) {
        axes = DEFAULT_AXES.map((a) => ({ ...a }))
      }
      continue
    }

    if (action === 'add') {
      if (axes.length >= MAX_AXES) {
        console.log(chalk.yellow(`\n軸は最大 ${MAX_AXES} 個までです。\n`))
        continue
      }
      const label = (await input({ message: '能力名' })).trim()
      if (!label) continue
      const focus = (await input({ message: '評価観点（focus）' })).trim()
      axes.push({ key: generateKey(), label, focus })
      continue
    }

    if (axes.length === 0) continue // 編集・削除する軸が無い

    if (action === 'edit') {
      const idx = await pickAxis(axes, '編集する軸を選んでください')
      const target = axes[idx]
      const label = (await input({ message: '能力名', default: target.label })).trim()
      const focus = (await input({ message: '評価観点（focus）', default: target.focus })).trim()
      // key は履歴の連続性のため維持する。空入力は元の値を据え置く
      axes[idx] = { key: target.key, label: label || target.label, focus: focus || target.focus }
      continue
    }

    if (action === 'remove') {
      const idx = await pickAxis(axes, '削除する軸を選んでください')
      const target = axes[idx]
      if (await confirm({ message: `「${target.label}」を削除しますか？`, default: false })) {
        axes.splice(idx, 1)
      }
    }
  }
}

// 軸を一覧から1つ選ばせ、その添字を返す
async function pickAxis(axes: Axis[], message: string): Promise<number> {
  return select({
    message,
    choices: axes.map((a, i) => ({ name: a.label, value: i })),
  })
}

// 現在の軸を label と focus つきで一覧表示する
function printAxes(axes: Axis[]): void {
  console.log()
  console.log(chalk.gray('現在の能力:'))
  if (axes.length === 0) {
    console.log(chalk.gray('  （なし）'))
  } else {
    axes.forEach((a, i) => {
      console.log(`  ${chalk.bold(`${i + 1}. ${a.label}`)}`)
      console.log(chalk.gray(`     ${a.focus}`))
    })
  }
  console.log()
}

// 新規軸の安定 key。履歴照合に使うだけなので不透明で良い
function generateKey(): string {
  return `axis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
