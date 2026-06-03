import chalk from 'chalk'
import type { AxisStore, ReportStore } from '../../core/ports/storage'
import { formatDate, resolveAxisLabel } from '../format'

export function actionsCommand(storage: ReportStore & AxisStore): void {
  const latest = storage.getLatestReport()
  if (!latest) {
    console.log(chalk.gray('\nまだレポートがありません。tanren report で解析してください。\n'))
    return
  }

  const withActions = latest.abilities.filter((a) => a.nextActions.length > 0)
  if (withActions.length === 0) {
    console.log(chalk.gray('\n次のアクションはありません。\n'))
    return
  }

  const labelOf = resolveAxisLabel(storage)
  console.log(
    chalk.cyan(
      `\n🎯 次のアクション  ${chalk.gray(`(レポート #${latest.id} / ${formatDate(latest.createdAt)})`)}\n`
    )
  )
  for (const ability of withActions) {
    console.log(chalk.bold.cyan(`■ ${labelOf(ability.axis)}`))
    for (const action of ability.nextActions) {
      console.log(`  - ${action}`)
    }
    console.log()
  }
}
