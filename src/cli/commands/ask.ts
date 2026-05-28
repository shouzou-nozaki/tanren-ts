import chalk from 'chalk'
import { input } from '@inquirer/prompts'
import { GeminiProvider } from '../../adapters/ai/gemini'
import { SqliteStorage } from '../../adapters/storage/sqlite'
import { chat } from '../../core/usecases/chat'

export async function askCommand(): Promise<void> {
  const storage = new SqliteStorage()
  const apiKey = storage.getConfig('gemini_api_key')

  if (!apiKey) {
    console.log(chalk.red('APIキーが設定されていません。先に tanren setup を実行してください。'))
    process.exit(1)
  }

  const provider = new GeminiProvider(apiKey)

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
