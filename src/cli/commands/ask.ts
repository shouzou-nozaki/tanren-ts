import chalk from 'chalk'
import { input } from '@inquirer/prompts'
import type { ProviderAgent } from '../../core/ports/ai-provider'
import type { Storage } from '../../core/ports/storage'
import { chat } from '../../core/usecases/chat'

export async function askCommand(provider: ProviderAgent, storage: Storage): Promise<void> {
  console.log(chalk.cyan('\n💬 tanren 壁打ちセッション'))
  if (provider.capabilities.readsLocalSource) {
    console.log(chalk.gray('コードのパスを貼れば読んで議論します'))
  }
  console.log(chalk.gray('終了するには Ctrl+C\n'))

  while (true) {
    let userInput: string
    try {
      userInput = await input({ message: chalk.green('あなた: ') })
    } catch (e) {
      // プロンプトでの Ctrl+C は正常終了として扱う
      if ((e as Error).name === 'ExitPromptError') break
      throw e
    }
    if (!userInput.trim()) continue

    process.stdout.write(chalk.blue('\nコーチ: '))
    await runTurn(userInput, provider, storage)
  }
}

async function runTurn(userInput: string, provider: ProviderAgent, storage: Storage): Promise<void> {
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
    await chat(userInput, provider, storage, (chunk) => process.stdout.write(chunk), controller.signal)
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
