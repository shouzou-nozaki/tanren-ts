import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { parse, stringify } from 'yaml'
import { z } from 'zod'
import type { AbilityReport, Axis, Report, Session, Storage } from '../../core/ports/storage'
import { DEFAULT_AXES } from '../../core/axes'

const DIR = join(homedir(), '.tanren')
const SESSIONS_FILE = join(DIR, 'sessions.yaml')
const REPORTS_FILE = join(DIR, 'reports.yaml')
const AXES_FILE = join(DIR, 'axes.yaml')
const CONFIG_FILE = join(DIR, 'config.yaml')

const sessionsFileSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.number(),
      createdAt: z.string(),
      messages: z.array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })
      ),
      axisKey: z.string().optional(),
    })
  ),
})

const reportsFileSchema = z.object({
  reports: z.array(
    z.object({
      id: z.number(),
      createdAt: z.string(),
      abilities: z.array(
        z.object({
          axis: z.string(),
          summary: z.string(),
          nextActions: z.array(z.string()).default([]),
          score: z.number().nullable().default(null),
        })
      ),
    })
  ),
})

const axesFileSchema = z.object({
  axes: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      focus: z.string(),
    })
  ),
})

const configFileSchema = z.record(z.string(), z.string())

export class YamlStorage implements Storage {
  getRecentSessions(limit: number, axisKey?: string): Session[] {
    const all = this.readSessions()
    const pool = axisKey ? all.filter((s) => s.axisKey === axisKey) : all
    return pool.slice(-limit)
  }

  getAllSessions(): Session[] {
    return this.readSessions()
  }

  getLatestReport(): Report | null {
    const reports = this.readReports()
    return reports[reports.length - 1] ?? null
  }

  getAllReports(): Report[] {
    return this.readReports()
  }

  saveReport(abilities: AbilityReport[]): void {
    const reports = this.readReports()
    const id = reports.length > 0 ? reports[reports.length - 1].id + 1 : 1
    reports.push({ id, createdAt: new Date().toISOString(), abilities })
    this.write(REPORTS_FILE, { reports })
  }

  saveSession(messages: Session['messages'], axisKey?: string): void {
    const sessions = this.readSessions()
    const id = sessions.length > 0 ? sessions[sessions.length - 1].id + 1 : 1
    sessions.push({ id, createdAt: new Date().toISOString(), messages, ...(axisKey ? { axisKey } : {}) })
    this.write(SESSIONS_FILE, { sessions })
  }

  getAxes(): Axis[] {
    const axes = this.readAxes()
    return axes.length > 0 ? axes : DEFAULT_AXES
  }

  saveAxes(axes: Axis[]): void {
    this.write(AXES_FILE, { axes })
  }

  getConfig(key: string): string | null {
    return this.readConfig()[key] ?? null
  }

  setConfig(key: string, value: string): void {
    const config = this.readConfig()
    config[key] = value
    this.write(CONFIG_FILE, config)
  }

  private readSessions(): Session[] {
    const raw = this.read(SESSIONS_FILE)
    if (raw === null) return []
    return this.validate(sessionsFileSchema, raw, SESSIONS_FILE).sessions
  }

  private readReports(): Report[] {
    const raw = this.read(REPORTS_FILE)
    if (raw === null) return []
    return this.validate(reportsFileSchema, raw, REPORTS_FILE).reports
  }

  private readAxes(): Axis[] {
    const raw = this.read(AXES_FILE)
    if (raw === null) return []
    return this.validate(axesFileSchema, raw, AXES_FILE).axes
  }

  private readConfig(): Record<string, string> {
    const raw = this.read(CONFIG_FILE)
    if (raw === null) return {}
    return this.validate(configFileSchema, raw, CONFIG_FILE)
  }

  private validate<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
    const result = schema.safeParse(data)
    // 壊れたデータは上書きせず中止し、ファイルを温存する
    if (!result.success) {
      throw new Error(`${file} の内容が不正です(上書きを中止しました): ${result.error.message}`)
    }
    return result.data
  }

  private read(file: string): unknown {
    if (!existsSync(file)) return null
    const raw = readFileSync(file, 'utf-8')
    try {
      return parse(raw) ?? null
    } catch (e) {
      throw new Error(`${file} のYAMLが壊れています(上書きを中止しました): ${(e as Error).message}`)
    }
  }

  private write(file: string, data: unknown): void {
    mkdirSync(DIR, { recursive: true })
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    try {
      writeFileSync(tmp, stringify(data), 'utf-8')
      renameSync(tmp, file)
    } catch (e) {
      if (existsSync(tmp)) {
        try {
          unlinkSync(tmp)
        } catch {}
      }
      throw e
    }
  }
}
