import chalk from 'chalk'
import type { ProviderAgent } from '../../core/ports/ai-provider'
import type { Storage } from '../../core/ports/storage'
import { analyze } from '../../core/usecases/analyze'

export async function reportCommand(provider: ProviderAgent, storage: Storage): Promise<void> {
  console.log(chalk.cyan('\n📊 tanren 実力解析'))
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
      },
      controller.signal
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
