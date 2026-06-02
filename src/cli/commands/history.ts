import chalk from 'chalk'
import type { AxisStore, Report, ReportStore } from '../../core/ports/storage'
import { listReports, getReport } from '../../core/usecases/history'

export function historyCommand(storage: ReportStore & AxisStore, id?: number): void {
  const labelOf = buildLabelResolver(storage)

  if (id !== undefined) {
    showReport(getReport(storage, id), labelOf)
    return
  }

  const reports = listReports(storage)
  if (reports.length === 0) {
    console.log(chalk.gray('\n保存されたレポートはありません。tanren report で解析してください。\n'))
    return
  }

  console.log(chalk.cyan('\n📚 解析レポート履歴\n'))
  for (const r of reports) {
    const axes = r.abilities.map((a) => labelOf(a.axis)).join(', ')
    console.log(`${chalk.bold(`#${r.id}`)}  ${chalk.gray(formatDate(r.createdAt))}  ${axes}`)
  }
  console.log(chalk.gray('\ntanren history <id> で詳細を表示します\n'))
}

function showReport(report: Report, labelOf: (axis: string) => string): void {
  console.log(chalk.cyan(`\n📊 レポート #${report.id}  ${chalk.gray(`(${formatDate(report.createdAt)})`)}\n`))
  for (const ability of report.abilities) {
    console.log(chalk.bold.cyan(`■ ${labelOf(ability.axis)}\n`))
    console.log(`${ability.summary}\n`)
  }
}

function buildLabelResolver(storage: AxisStore): (axis: string) => string {
  const labels = new Map(storage.getAxes().map((a) => [a.key, a.label]))
  return (axis) => labels.get(axis) ?? axis
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}
