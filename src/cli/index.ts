import { program } from 'commander'
import { select } from '@inquirer/prompts'
import chalk from 'chalk'
import { buildContainer } from './container'
import { setupCommand } from './commands/setup'
import { askCommand } from './commands/ask'

const { storage, buildProvider } = buildContainer()

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
  .action(() => {
    try {
      askCommand(buildProvider(), storage)
    } catch (e) {
      console.log(chalk.red((e as Error).message))
      process.exit(1)
    }
  })

program.action(async () => {
  const command = await select({
    message: 'tanren',
    choices: [
      { name: '💬 壁打ち', value: 'ask' },
      { name: '🔧 セットアップ', value: 'setup' },
    ],
  })

  if (command === 'ask') {
    try {
      await askCommand(buildProvider(), storage)
    } catch (e) {
      console.log(chalk.red((e as Error).message))
      process.exit(1)
    }
  }
  if (command === 'setup') await setupCommand(storage)
})

program.parse()
