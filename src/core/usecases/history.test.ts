import { describe, it, expect } from 'vitest'
import { listReports, getReport } from './history'
import { MemoryStorage } from '../../adapters/storage/memory'

function seed(): MemoryStorage {
  const s = new MemoryStorage()
  s.saveReport([{ axis: 'a', summary: 's1' }])
  s.saveReport([{ axis: 'a', summary: 's2' }])
  return s
}

describe('listReports', () => {
  it('レポートが無ければ空配列', () => {
    expect(listReports(new MemoryStorage())).toEqual([])
  })

  it('新しい順に返す', () => {
    const reports = listReports(seed())
    expect(reports.map((r) => r.id)).toEqual([2, 1])
  })

  it('元の配列を破壊しない', () => {
    const s = seed()
    listReports(s)
    expect(s.getAllReports().map((r) => r.id)).toEqual([1, 2])
  })
})

describe('getReport', () => {
  it('idで該当レポートを返す', () => {
    expect(getReport(seed(), 1).abilities[0].summary).toBe('s1')
  })

  it('存在しないidは例外を投げる', () => {
    expect(() => getReport(seed(), 99)).toThrow('#99')
  })
})
