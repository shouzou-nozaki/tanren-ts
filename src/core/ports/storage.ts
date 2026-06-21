import type { Message } from './ai-provider'

export type Session = {
  id: number
  createdAt: string
  messages: Message[]
  axisKey?: string
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
}

export type Report = {
  id: number
  createdAt: string
  abilities: AbilityReport[]
}

export interface SessionStore {
  getRecentSessions(limit: number, axisKey?: string): Session[]
  getAllSessions(): Session[]
  saveSession(messages: Message[], axisKey?: string): void
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
