import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_AXES } from '../../core/axes'
import type { Storage } from '../../core/ports/storage'

let TANREN_DIR: string
let makeStorage: () => Storage

beforeAll(async () => {
  // YamlStorage は import 時に homedir() で保存先を確定するため、先に HOME を差し替える
  const home = mkdtempSync(join(tmpdir(), 'tanren-test-'))
  process.env.HOME = home
  TANREN_DIR = join(home, '.tanren')
  const mod = await import('./yaml')
  makeStorage = () => new mod.YamlStorage()
})

beforeEach(() => {
  rmSync(TANREN_DIR, { recursive: true, force: true })
})

afterAll(() => {
  rmSync(TANREN_DIR, { recursive: true, force: true })
})

function writeRaw(file: string, content: string): void {
  mkdirSync(TANREN_DIR, { recursive: true })
  writeFileSync(join(TANREN_DIR, file), content, 'utf-8')
}

describe('YamlStorage', () => {
  it('セッションを保存して読み戻せる', () => {
    const s = makeStorage()
    s.saveSession([{ role: 'user', content: 'Q' }])
    s.saveSession([{ role: 'user', content: 'Q2' }])

    expect(s.getAllSessions()).toHaveLength(2)
    expect(s.getRecentSessions(1)[0].messages[0].content).toBe('Q2')
    expect(s.getAllSessions().map((x) => x.id)).toEqual([1, 2])
  })

  it('レポートを保存して最新を取得できidが採番される', () => {
    const s = makeStorage()
    s.saveReport([{ axis: 'design', summary: 'r1', nextActions: [], score: 2 }])
    s.saveReport([{ axis: 'design', summary: 'r2', nextActions: [], score: 3 }])

    const latest = s.getLatestReport()
    expect(latest?.id).toBe(2)
    expect(latest?.abilities[0].summary).toBe('r2')
  })

  it('次アクション付きレポートを読み戻せる', () => {
    makeStorage().saveReport([{ axis: 'a', summary: 's', nextActions: ['x', 'y'], score: null }])
    expect(makeStorage().getLatestReport()?.abilities[0].nextActions).toEqual(['x', 'y'])
  })

  it('nextActions の無い旧レポートは空配列として読む', () => {
    writeRaw(
      'reports.yaml',
      'reports:\n  - id: 1\n    createdAt: "2026-01-01T00:00:00Z"\n    abilities:\n      - axis: a\n        summary: s\n'
    )
    expect(makeStorage().getLatestReport()?.abilities[0].nextActions).toEqual([])
  })

  it('score の無い旧レポートは未評価(null)として読む', () => {
    writeRaw(
      'reports.yaml',
      'reports:\n  - id: 1\n    createdAt: "2026-01-01T00:00:00Z"\n    abilities:\n      - axis: a\n        summary: s\n'
    )
    expect(makeStorage().getLatestReport()?.abilities[0].score).toBeNull()
  })

  it('config を保存して読み戻せる', () => {
    const s = makeStorage()
    s.setConfig('provider', 'claude')
    expect(s.getConfig('provider')).toBe('claude')
    expect(s.getConfig('missing')).toBeNull()
  })

  it('軸ファイルが無ければ既定軸にフォールバックする', () => {
    const s = makeStorage()
    expect(s.getAxes()).toEqual(DEFAULT_AXES)
  })

  it('保存した軸を読み戻す', () => {
    const s = makeStorage()
    const axes = [{ key: 'k', label: 'L', focus: 'F' }]
    s.saveAxes(axes)
    expect(makeStorage().getAxes()).toEqual(axes)
  })

  it('別インスタンスからでも永続化された内容を読める', () => {
    makeStorage().saveReport([{ axis: 'a', summary: 's', nextActions: [], score: null }])
    expect(makeStorage().getLatestReport()?.abilities[0].summary).toBe('s')
  })

  it('壊れたYAMLは例外を投げ、ファイルを温存する', () => {
    writeRaw('reports.yaml', ':\n  - [invalid')
    const before = readFileSync(join(TANREN_DIR, 'reports.yaml'), 'utf-8')
    const s = makeStorage()

    expect(() => s.getLatestReport()).toThrow()
    // 上書きされず元の内容が残っている
    expect(readFileSync(join(TANREN_DIR, 'reports.yaml'), 'utf-8')).toBe(before)
  })

  it('スキーマ不一致は例外を投げ、保存で既存データを潰さない', () => {
    writeRaw('reports.yaml', 'reports:\n  - id: "not-a-number"\n')
    const before = readFileSync(join(TANREN_DIR, 'reports.yaml'), 'utf-8')
    const s = makeStorage()

    // saveReport は既存読み込み→検証で失敗し、書き込みに到達しない
    expect(() => s.saveReport([{ axis: 'a', summary: 's', nextActions: [], score: null }])).toThrow()
    expect(readFileSync(join(TANREN_DIR, 'reports.yaml'), 'utf-8')).toBe(before)
  })

  it('保存はアトミックで一時ファイルを残さない', () => {
    const s = makeStorage()
    s.saveReport([{ axis: 'a', summary: 's', nextActions: [], score: null }])
    expect(existsSync(join(TANREN_DIR, 'reports.yaml'))).toBe(true)
    const leftover = readdirSync(TANREN_DIR).filter((f) => f.includes('.tmp'))
    expect(leftover).toHaveLength(0)
  })
})
