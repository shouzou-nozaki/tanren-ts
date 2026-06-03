import { program } from 'commander'
import { select } from '@inquirer/prompts'
import chalk from 'chalk'
import { buildContainer } from './container'
import { isProviderConfigured } from '../adapters/ai/registry'
import { setupCommand } from './commands/setup'
import { askCommand } from './commands/ask'
import { reportCommand } from './commands/report'
import { historyCommand } from './commands/history'
import { actionsCommand } from './commands/actions'

const { storage, buildProvider } = buildContainer()

// 初回(プロバイダ未設定)は対話があればセットアップへ誘導する。非対話なら素通りし後段のエラーに委ねる
async function ensureConfigured(): Promise<void> {
  if (isProviderConfigured(storage)) return
  if (!process.stdin.isTTY) return
  console.log(chalk.yellow('\n👋 ようこそ tanren へ。初回セットアップを行います。'))
  await setupCommand(storage)
}

async function runAsk(): Promise<void> {
  try {
    await ensureConfigured()
    await askCommand(buildProvider(), storage)
  } catch (e) {
    console.log(chalk.red((e as Error).message))
    process.exit(1)
  }
}

async function runReport(): Promise<void> {
  try {
    await ensureConfigured()
    await reportCommand(buildProvider(), storage)
  } catch (e) {
    console.log(chalk.red((e as Error).message))
    process.exit(1)
  }
}

function runHistory(id?: string): void {
  try {
    historyCommand(storage, id !== undefined ? Number(id) : undefined)
  } catch (e) {
    console.log(chalk.red((e as Error).message))
    process.exit(1)
  }
}

program
  .name('tanren')
  .description('Technical Agent for Nurturing & Reinforcing Engineering Navigation')
  .version('0.1.0')

program
  .command('setup')
  .description('初期設定')
  .action(() => setupCommand(storage))

program
  .command('ask')
  .description('壁打ちセッションを開始する')
  .action(runAsk)

program
  .command('report')
  .description('壁打ち履歴から実力を解析する')
  .action(runReport)

program
  .command('history [id]')
  .description('過去の解析レポートを閲覧する')
  .action(runHistory)

program
  .command('actions')
  .description('次に取り組むべきことを表示する')
  .action(() => actionsCommand(storage))

program.action(async () => {
  const command = await select({
    message: 'tanren',
    choices: [
      { name: '💬 壁打ち', value: 'ask' },
      { name: '📊 実力解析', value: 'report' },
      { name: '🎯 次のアクション', value: 'actions' },
      { name: '📚 レポート履歴', value: 'history' },
      { name: '🔧 セットアップ', value: 'setup' },
    ],
  })

  if (command === 'ask') await runAsk()
  if (command === 'report') await runReport()
  if (command === 'actions') actionsCommand(storage)
  if (command === 'history') runHistory()
  if (command === 'setup') await setupCommand(storage)
})

program.parse()
