import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { parse, stringify } from 'yaml'
import { z } from 'zod'
import type { Session, Storage } from '../../core/ports/storage'

const DIR = join(homedir(), '.tanren')
const SESSIONS_FILE = join(DIR, 'sessions.yaml')
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
    })
  ),
})

const configFileSchema = z.record(z.string(), z.string())

export class YamlStorage implements Storage {
  getRecentSessions(limit: number): Session[] {
    return this.readSessions().slice(-limit)
  }

  saveSession(messages: Session['messages']): void {
    const sessions = this.readSessions()
    const id = sessions.length > 0 ? sessions[sessions.length - 1].id + 1 : 1
    sessions.push({ id, createdAt: new Date().toISOString(), messages })
    this.write(SESSIONS_FILE, { sessions })
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
