import chalk from 'chalk'
import { input } from '@inquirer/prompts'
import type { ProviderAgent } from '../../core/ports/ai-provider'
import type { Storage } from '../../core/ports/storage'
import { chat } from '../../core/usecases/chat'

export async function askCommand(provider: ProviderAgent, storage: Storage): Promise<void> {
  console.log(chalk.cyan('\n💬 tanren 壁打ちセッション'))
  console.log(chalk.gray('終了するには Ctrl+C\n'))

  while (true) {
    const userInput = await input({ message: chalk.green('あなた: ') })
    if (!userInput.trim()) continue

    process.stdout.write(chalk.blue('\nコーチ: '))
    await chat(userInput, provider, storage, (chunk) => process.stdout.write(chunk))
    console.log('\n')
  }
}
