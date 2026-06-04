import chalk from 'chalk'
import type { AbilityReport, AxisStore, Report, ReportStore } from '../../core/ports/storage'
import { getReport, listReports } from '../../core/usecases/history'
import { formatDate, resolveAxisLabel } from '../format'

export function historyCommand(storage: ReportStore & AxisStore, id?: number): void {
  const labelOf = resolveAxisLabel(storage)
  const reports = storage.getAllReports()

  if (id !== undefined) {
    const target = getReport(storage, id)
    const idx = reports.findIndex((r) => r.id === id)
    showReport(target, reports[idx - 1] ?? null, labelOf)
    return
  }

  if (reports.length === 0) {
    console.log(chalk.gray('\n保存されたレポートはありません。tanren report で解析してください。\n'))
    return
  }

  console.log(chalk.cyan('\n📚 解析レポート履歴\n'))
  for (const r of listReports(storage)) {
    const axes = r.abilities.map((a) => labelOf(a.axis)).join(', ')
    console.log(`${chalk.bold(`#${r.id}`)}  ${chalk.gray(formatDate(r.createdAt))}  ${axes}`)
  }

  printTrend(reports, labelOf)
  console.log(chalk.gray('\ntanren history <id> で詳細を表示します\n'))
}

function showReport(report: Report, previous: Report | null, labelOf: (axis: string) => string): void {
  console.log(chalk.cyan(`\n📊 レポート #${report.id}  ${chalk.gray(`(${formatDate(report.createdAt)})`)}\n`))
  for (const ability of report.abilities) {
    const prev = previous?.abilities.find((a) => a.axis === ability.axis) ?? null
    console.log(chalk.bold.cyan(`■ ${labelOf(ability.axis)}  ${scoreLine(ability, prev)}\n`))
    console.log(`${ability.summary}\n`)
  }
}

function scoreLine(ability: AbilityReport, prev: AbilityReport | null): string {
  if (ability.score === null) return chalk.gray('未評価')
  const stars = '★'.repeat(ability.score) + '☆'.repeat(5 - ability.score)
  if (ability.carriedOver) return chalk.gray(`${stars} ${ability.score}/5 (据え置き)`)
  if (prev && prev.score !== null) {
    const d = ability.score - prev.score
    const delta = d > 0 ? chalk.green(`+${d}`) : d < 0 ? chalk.red(String(d)) : '±0'
    return `${stars} ${ability.score}/5 ${chalk.gray(`(前回 ${prev.score} → ${delta})`)}`
  }
  return `${stars} ${ability.score}/5 ${chalk.gray('(初採点)')}`
}

function printTrend(reports: Report[], labelOf: (axis: string) => string): void {
  const keys: string[] = []
  for (const r of reports) for (const a of r.abilities) if (!keys.includes(a.axis)) keys.push(a.axis)

  console.log(chalk.cyan('\n📈 スコア推移\n'))
  for (const key of keys) {
    const seq = reports
      .map((r) => {
        const a = r.abilities.find((x) => x.axis === key)
        return a && a.score !== null ? String(a.score) : '・'
      })
      .join(' → ')
    console.log(`${labelOf(key)}: ${seq}`)
  }
}
