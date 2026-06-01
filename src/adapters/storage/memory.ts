import type { Message } from '../../core/ports/ai-provider'
import type { Report, Session, Storage } from '../../core/ports/storage'

export class MemoryStorage implements Storage {
  private sessions: Session[] = []
  private reports: Report[] = []
  private config = new Map<string, string>()
  private nextId = 1
  private nextReportId = 1

  getRecentSessions(limit: number): Session[] {
    return this.sessions.slice(-limit)
  }

  getAllSessions(): Session[] {
    return [...this.sessions]
  }

  getLatestReport(): Report | null {
    return this.reports[this.reports.length - 1] ?? null
  }

  saveReport(content: string): void {
    this.reports.push({ id: this.nextReportId++, createdAt: new Date().toISOString(), content })
  }

  saveSession(messages: Message[]): void {
    this.sessions.push({
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      messages,
    })
  }

  getConfig(key: string): string | null {
    return this.config.get(key) ?? null
  }

  setConfig(key: string, value: string): void {
    this.config.set(key, value)
  }
}
