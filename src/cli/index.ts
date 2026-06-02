import { program } from 'commander'
import { select } from '@inquirer/prompts'
import chalk from 'chalk'
import { buildContainer } from './container'
import { setupCommand } from './commands/setup'
import { askCommand } from './commands/ask'
import { reportCommand } from './commands/report'
import { historyCommand } from './commands/history'

const { storage, buildProvider } = buildContainer()

async function runAsk(): Promise<void> {
  try {
    await askCommand(buildProvider(), storage)
  } catch (e) {
    console.log(chalk.red((e as Error).message))
    process.exit(1)
  }
}

async function runReport(): Promise<void> {
  try {
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

program.action(async () => {
  const command = await select({
    message: 'tanren',
    choices: [
      { name: '💬 壁打ち', value: 'ask' },
      { name: '📊 実力解析', value: 'report' },
      { name: '📚 レポート履歴', value: 'history' },
      { name: '🔧 セットアップ', value: 'setup' },
    ],
  })

  if (command === 'ask') await runAsk()
  if (command === 'report') await runReport()
  if (command === 'history') runHistory()
  if (command === 'setup') await setupCommand(storage)
})

program.parse()
