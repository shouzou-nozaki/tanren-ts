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
import { axesCommand } from './commands/axes'

declare const __APP_VERSION__: string
const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev'

const { storage, buildProvider } = buildContainer()

// 初回(プロバイダ未設定)は対話があればセットアップへ誘導する。非対話なら素通りし後段のエラーに委ねる
async function ensureConfigured(): Promise<void> {
  if (isProviderConfigured(storage)) return
  if (!process.stdin.isTTY) return
  console.log(chalk.yellow('\n👋 ようこそ tanren へ。初回セットアップを行います。'))
  await setupCommand(storage)
}

type Command = 'ask' | 'report' | 'actions' | 'history' | 'axes' | 'setup'

// 各コマンドを実行する。エラーは投げ、終了の判断は呼び出し側に委ねる
async function dispatch(command: Command): Promise<void> {
  switch (command) {
    case 'ask':
      await ensureConfigured()
      await askCommand(buildProvider(), storage)
      break
    case 'report':
      await ensureConfigured()
      await reportCommand(buildProvider(), storage)
      break
    case 'actions':
      actionsCommand(storage)
      break
    case 'history':
      historyCommand(storage)
      break
    case 'axes':
      await axesCommand(storage)
      break
    case 'setup':
      await setupCommand(storage)
      break
  }
}

const isCancel = (e: unknown): boolean => (e as Error)?.name === 'ExitPromptError'

// 引数つきの直叩き: 一発実行して終わる。エラーは終了コード1で抜ける
async function oneShot(run: () => Promise<void> | void): Promise<void> {
  try {
    await run()
  } catch (e) {
    console.log(chalk.red((e as Error).message))
    process.exit(1)
  }
}

// 引数なし: メニューをループし、tanren の中で作業し続けられるようにする
async function runMenu(): Promise<void> {
  while (true) {
    let command: Command | 'quit'
    try {
      command = await select<Command | 'quit'>({
        message: 'tanren',
        choices: [
          { name: '💬 壁打ち', value: 'ask' },
          { name: '📊 実力解析', value: 'report' },
          { name: '🎯 次のアクション', value: 'actions' },
          { name: '📚 レポート履歴', value: 'history' },
          { name: '🎯 能力を設定', value: 'axes' },
          { name: '🔧 セットアップ', value: 'setup' },
          { name: '🚪 終了', value: 'quit' },
        ],
      })
    } catch (e) {
      if (isCancel(e)) break // メニューで Ctrl+C → 終了
      throw e
    }

    if (command === 'quit') break

    try {
      await dispatch(command)
    } catch (e) {
      if (isCancel(e)) continue // プロンプトのキャンセルはメニューに戻るだけ
      console.log(chalk.red((e as Error).message)) // エラーでもシェルは止めない
    }
  }
}

program
  .name('tanren')
  .description('Technical Agent for Nurturing & Reinforcing Engineering Navigation')
  .version(version)

program
  .command('setup')
  .description('初期設定')
  .action(() => oneShot(() => setupCommand(storage)))

program
  .command('ask')
  .description('壁打ちセッションを開始する')
  .action(() => oneShot(() => dispatch('ask')))

program
  .command('report')
  .description('壁打ち履歴から実力を解析する')
  .action(() => oneShot(() => dispatch('report')))

program
  .command('history [id]')
  .description('過去の解析レポートを閲覧する')
  .action((id?: string) =>
    oneShot(() => historyCommand(storage, id !== undefined ? Number(id) : undefined))
  )

program
  .command('actions')
  .description('次に取り組むべきことを表示する')
  .action(() => oneShot(() => actionsCommand(storage)))

program
  .command('axes')
  .description('伸ばす能力（軸）を設定する')
  .action(() => oneShot(() => axesCommand(storage)))

program.action(() => runMenu())

program.parse()
