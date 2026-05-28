import { program } from 'commander'
import { select } from '@inquirer/prompts'
import { setupCommand } from './commands/setup'
import { askCommand } from './commands/ask'

program
  .name('tanren')
  .description('Technical Agent for Nurturing & Reinforcing Engineering Navigation')
  .version('0.1.0')

program
  .command('setup')
  .description('初期設定')
  .action(setupCommand)

program
  .command('ask')
  .description('壁打ちセッションを開始する')
  .action(askCommand)

// 引数なしで実行したときはメニューを表示
program.action(async () => {
  const command = await select({
    message: 'tanren',
    choices: [
      { name: '💬 壁打ち', value: 'ask' },
      { name: '🔧 セットアップ', value: 'setup' },
    ],
  })

  if (command === 'ask') await askCommand()
  if (command === 'setup') await setupCommand()
})

program.parse()
