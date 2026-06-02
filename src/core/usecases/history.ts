import type { Report, ReportStore } from '../ports/storage'

export function listReports(storage: ReportStore): Report[] {
  return [...storage.getAllReports()].reverse()
}

export function getReport(storage: ReportStore, id: number): Report {
  const report = storage.getAllReports().find((r) => r.id === id)
  if (!report) {
    throw new Error(`レポート #${id} が見つかりません。tanren history で一覧を確認してください。`)
  }
  return report
}
