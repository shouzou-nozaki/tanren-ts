import chalk from 'chalk'
import { input } from '@inquirer/prompts'
import { SqliteStorage } from '../../adapters/storage/sqlite'

export async function setupCommand(): Promise<void> {
  console.log(chalk.cyan('\n🔧 tanren セットアップ\n'))

  const storage = new SqliteStorage()

  const apiKey = await input({
    message: 'Gemini APIキー (Google AI Studio): ',
    validate: (v) => v.trim().length > 0 || 'APIキーを入力してください',
  })

  storage.setConfig('gemini_api_key', apiKey.trim())

  console.log(chalk.green('\n✅ セットアップ完了\n'))
  console.log('使い方: tanren ask')
}
