import type { Message } from '../../core/ports/ai-provider'
import type { Session, Storage } from '../../core/ports/storage'

// プロセス内に保持する揮発ストレージ。テストや差し替え確認用
export class MemoryStorage implements Storage {
  private sessions: Session[] = []
  private config = new Map<string, string>()
  private nextId = 1

  getRecentSessions(limit: number): Session[] {
    return this.sessions.slice(-limit)
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
