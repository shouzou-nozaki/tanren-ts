import chalk from 'chalk'
import { input, select } from '@inquirer/prompts'
import type { Storage } from '../../core/ports/storage'
import { saveProviderConfig, requiresApiKey } from '../../adapters/ai/registry'
import { PROVIDER_NAMES, type ProviderName } from '../container'

export async function setupCommand(storage: Storage): Promise<void> {
  console.log(chalk.cyan('\n🔧 tanren セットアップ\n'))

  const provider = await select<ProviderName>({
    message: 'AIプロバイダーを選択してください',
    choices: PROVIDER_NAMES.map((name) => ({
      name: providerLabel(name),
      value: name,
    })),
  })

  let apiKey: string | undefined
  if (requiresApiKey(provider)) {
    apiKey = (
      await input({
        message: `${provider} APIキー: `,
        validate: (v) => v.trim().length > 0 || 'APIキーを入力してください',
      })
    ).trim()
  } else {
    console.log(chalk.gray('Claude Code のログインを使用します(APIキー不要)'))
  }

  saveProviderConfig(storage, provider, apiKey)
  storage.saveAxes(storage.getAxes())

  console.log(chalk.green('\n✅ セットアップ完了\n'))
  console.log('使い方: tanren ask')
  console.log(chalk.gray('解析する能力軸は ~/.tanren/axes.yaml で編集できます'))
}

function providerLabel(name: ProviderName): string {
  switch (name) {
    case 'gemini':
      return 'Gemini (Google AI Studio・無料枠あり)'
    case 'claude':
      return 'Claude (Claude Code のログインを使用・APIキー不要)'
  }
}
