#!/usr/bin/env node
import { program } from 'commander'
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

program.parse()
