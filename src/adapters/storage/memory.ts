import type { Message } from '../../core/ports/ai-provider'
import type { AbilityReport, Axis, Report, Session, Storage } from '../../core/ports/storage'
import { DEFAULT_AXES } from '../../core/axes'

export class MemoryStorage implements Storage {
  private sessions: Session[] = []
  private reports: Report[] = []
  private axes: Axis[] = DEFAULT_AXES
  private config = new Map<string, string>()
  private nextId = 1
  private nextReportId = 1

  getRecentSessions(limit: number, axisKey?: string): Session[] {
    const pool = axisKey ? this.sessions.filter((s) => s.axisKey === axisKey) : this.sessions
    return pool.slice(-limit)
  }

  getAllSessions(): Session[] {
    return [...this.sessions]
  }

  getLatestReport(): Report | null {
    return this.reports[this.reports.length - 1] ?? null
  }

  getAllReports(): Report[] {
    return [...this.reports]
  }

  saveReport(abilities: AbilityReport[]): void {
    this.reports.push({ id: this.nextReportId++, createdAt: new Date().toISOString(), abilities })
  }

  saveSession(messages: Message[], axisKey: string): void {
    this.sessions.push({
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      messages,
      axisKey,
    })
  }

  getAxes(): Axis[] {
    return this.axes
  }

  saveAxes(axes: Axis[]): void {
    this.axes = axes
  }

  getConfig(key: string): string | null {
    return this.config.get(key) ?? null
  }

  setConfig(key: string, value: string): void {
    this.config.set(key, value)
  }
}
