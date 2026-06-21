import chalk from 'chalk'
import { select } from '@inquirer/prompts'
import type { ProviderAgent } from '../../core/ports/ai-provider'
import type { Axis, Storage } from '../../core/ports/storage'
import { analyze } from '../../core/usecases/analyze'

export async function reportCommand(provider: ProviderAgent, storage: Storage): Promise<void> {
  console.log(chalk.cyan('\n📊 tanren 実力解析'))

  // 設定済みの軸から解析する1つを選ぶ
  const targetAxis = await selectAxis(storage.getAxes())
  console.log(chalk.gray('履歴を解析しています...\n'))

  const controller = new AbortController()
  let interrupts = 0
  const onSigint = (): void => {
    interrupts += 1
    if (interrupts === 1) {
      controller.abort()
      return
    }
    process.exit(130)
  }
  process.on('SIGINT', onSigint)

  try {
    await analyze(
      provider,
      storage,
      {
        onAxisStart: (label) => console.log(chalk.bold.cyan(`\n■ ${label}\n`)),
        onChunk: (chunk) => process.stdout.write(chunk),
        onAxisSkip: (label) =>
          console.log(chalk.gray(`（${label}: 解析できる壁打ちが無いためスキップ）`)),
      },
      controller.signal,
      [targetAxis]
    )
    console.log('\n')
  } catch (e) {
    if (controller.signal.aborted) {
      console.log(chalk.yellow('\n（中断しました）\n'))
    } else {
      console.log(chalk.red(`\nエラー: ${(e as Error).message}\n`))
    }
  } finally {
    process.removeListener('SIGINT', onSigint)
  }
}

// 設定済みの軸が複数あれば解析する1つを選ばせる。1つなら選択を省く
async function selectAxis(axes: Axis[]): Promise<Axis> {
  if (axes.length === 1) return axes[0]
  const key = await select({
    message: '解析する能力を選んでください',
    choices: axes.map((a) => ({ name: a.label, value: a.key })),
  })
  return axes.find((a) => a.key === key) ?? axes[0]
}
