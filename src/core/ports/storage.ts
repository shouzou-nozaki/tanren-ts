import type { Message } from './ai-provider'

export type Session = {
  id: number
  createdAt: string
  messages: Message[]
}

export type Report = {
  id: number
  createdAt: string
  content: string
}

export interface Storage {
  getRecentSessions(limit: number): Session[]
  getAllSessions(): Session[]
  saveSession(messages: Message[]): void
  getLatestReport(): Report | null
  saveReport(content: string): void
  getConfig(key: string): string | null
  setConfig(key: string, value: string): void
}
