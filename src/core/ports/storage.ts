import type { Message } from './ai-provider'

export type Session = {
  id: number
  createdAt: string
  messages: Message[]
}

export type Axis = {
  key: string
  label: string
  focus: string
}

export type AbilityReport = {
  axis: string
  summary: string
  nextActions: string[]
  score: number | null
  carriedOver: boolean
}

export type Report = {
  id: number
  createdAt: string
  abilities: AbilityReport[]
}

export interface SessionStore {
  getRecentSessions(limit: number): Session[]
  getAllSessions(): Session[]
  saveSession(messages: Message[]): void
}

export interface ReportStore {
  getLatestReport(): Report | null
  getAllReports(): Report[]
  saveReport(abilities: AbilityReport[]): void
}

export interface AxisStore {
  getAxes(): Axis[]
  saveAxes(axes: Axis[]): void
}

export interface ConfigStore {
  getConfig(key: string): string | null
  setConfig(key: string, value: string): void
}

export interface Storage extends SessionStore, ReportStore, AxisStore, ConfigStore {}
