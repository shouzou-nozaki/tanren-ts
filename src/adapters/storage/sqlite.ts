import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type { Message } from '../../core/ports/ai-provider'
import type { Session, Storage } from '../../core/ports/storage'

const DB_DIR = join(homedir(), '.tanren')
const DB_PATH = join(DB_DIR, 'tanren.db')

export class SqliteStorage implements Storage {
  private _db: Database.Database | null = null

  private get db(): Database.Database {
    if (this._db) return this._db
    mkdirSync(DB_DIR, { recursive: true })
    this._db = new Database(DB_PATH)
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        messages TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    return this._db
  }

  getRecentSessions(limit: number): Session[] {
    const rows = this.db
      .prepare('SELECT id, created_at, messages FROM sessions ORDER BY created_at DESC LIMIT ?')
      .all(limit) as { id: number; created_at: string; messages: string }[]

    return rows
      .reverse()
      .map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        messages: JSON.parse(r.messages) as Message[],
      }))
  }

  saveSession(messages: Message[]): void {
    this.db
      .prepare('INSERT INTO sessions (messages) VALUES (?)')
      .run(JSON.stringify(messages))
  }

  getConfig(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM config WHERE key = ?')
      .get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  setConfig(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  }
}
