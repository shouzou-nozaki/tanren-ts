import chalk from 'chalk'
import { select } from '@inquirer/prompts'
import type { ProviderAgent } from '../../core/ports/ai-provider'
import type { Axis, Storage } from '../../core/ports/storage'
import { chat, RECENT_TURNS } from '../../core/usecases/chat'
import { formatRecap } from '../format'
import { readMultilineInput } from '../input'

export async function askCommand(provider: ProviderAgent, storage: Storage): Promise<void> {
  console.log(chalk.cyan('\n💬 tanren 壁打ちセッション'))
  if (provider.capabilities.readsLocalSource) {
    console.log(chalk.gray('コードのパスを貼れば読んで議論します'))
  }
  console.log(
    chalk.gray('Enterで送信 / 改行は Shift+Enter か Ctrl+J / 貼り付けは複数行OK / 終了は Ctrl+C\n')
  )

  // 設定済みの軸から今回フォーカスする1つを選ぶ。コーチはその軸を重点的に掘る
  const focusAxis = await selectFocusAxis(storage.getAxes())
  console.log(chalk.gray(`今回のフォーカス: ${focusAxis.label}\n`))

  // コーチが文脈として覚えている直近の会話を、ユーザーにも見せてから続きを始める
  const recent = storage.getRecentSessions(RECENT_TURNS)
  if (recent.length > 0) {
    console.log(chalk.gray('── これまでの会話 ──'))
    console.log(chalk.gray(formatRecap(recent)))
    console.log(chalk.gray('────────────────\n'))
  }

  while (true) {
    // Ctrl+C / EOF は null。壁打ちを抜けてメニューへ戻す
    const userInput = await readMultilineInput('あなた: ')
    if (userInput === null) break
    if (!userInput.trim()) continue

    process.stdout.write(chalk.blue('\nコーチ: '))
    await runTurn(userInput, provider, storage, focusAxis)
  }
}

// 設定済みの軸が複数あれば今回フォーカスする1つを選ばせる。1つなら選択を省く
async function selectFocusAxis(axes: Axis[]): Promise<Axis> {
  if (axes.length === 1) return axes[0]
  const key = await select({
    message: '今回フォーカスする能力を選んでください',
    choices: axes.map((a) => ({ name: a.label, value: a.key })),
  })
  return axes.find((a) => a.key === key) ?? axes[0]
}

async function runTurn(
  userInput: string,
  provider: ProviderAgent,
  storage: Storage,
  focusAxis: Axis
): Promise<void> {
  const controller = new AbortController()
  let interrupts = 0
  const onSigint = (): void => {
    interrupts += 1
    // 1回目は応答を中断してプロンプトへ戻す。2回目は強制終了
    if (interrupts === 1) {
      controller.abort()
      return
    }
    process.exit(130)
  }
  process.on('SIGINT', onSigint)

  try {
    await chat(
      userInput,
      provider,
      storage,
      focusAxis,
      (chunk) => process.stdout.write(chunk),
      controller.signal
    )
    console.log('\n')
  } catch (e) {
    if (controller.signal.aborted) {
      console.log(chalk.yellow('\n（中断しました）\n'))
    } else {
      // 1ターンの失敗ではセッションを止めず、次の入力へ続ける
      console.log(chalk.red(`\nエラー: ${(e as Error).message}\n`))
    }
  } finally {
    process.removeListener('SIGINT', onSigint)
  }
}
