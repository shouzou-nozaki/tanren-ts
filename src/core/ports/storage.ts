import type { Message } from './ai-provider'

export type Session = {
  id: number
  createdAt: string
  messages: Message[]
}

export interface Storage {
  getRecentSessions(limit: number): Session[]
  saveSession(messages: Message[]): void
  getConfig(key: string): string | null
  setConfig(key: string, value: string): void
}
