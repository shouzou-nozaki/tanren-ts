import type { Message } from './ai-provider'

export type Session = {
  id: number
  createdAt: string
  messages: Message[]
}

export type AbilityReport = {
  axis: string
  summary: string
}

export type Report = {
  id: number
  createdAt: string
  abilities: AbilityReport[]
}

export interface Storage {
  getRecentSessions(limit: number): Session[]
  getAllSessions(): Session[]
  saveSession(messages: Message[]): void
  getLatestReport(): Report | null
  saveReport(abilities: AbilityReport[]): void
  getConfig(key: string): string | null
  setConfig(key: string, value: string): void
}
