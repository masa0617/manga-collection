import { describe, expect, it } from 'vitest'
import type { Series } from '../types'
import { withCorrectedManualTotal } from './volumeCheckScheduler'

function isoDaysFromNow(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function series(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    name: 'テスト',
    author: '著者',
    createdAt: 0,
    ...overrides,
  }
}

describe('withCorrectedManualTotal', () => {
  it('does nothing when no manual total is set', () => {
    const s = series({ estimatedTotalVolumeCount: 12, estimatedLatestReleaseDateISO: isoDaysFromNow(-1) })
    expect(withCorrectedManualTotal(s, 10)).toBe(s)
  })

  it('leaves a manual total untouched when nothing contradicts it (basically immutable)', () => {
    const s = series({ manualTotalVolumeCount: 10 })
    expect(withCorrectedManualTotal(s, 10)).toBe(s)
  })

  it('bumps a manual total up to what is actually owned when it has fallen below it', () => {
    const s = series({ manualTotalVolumeCount: 8 })
    const result = withCorrectedManualTotal(s, 10)
    expect(result.manualTotalVolumeCount).toBe(10)
    expect(result.manualTotalVolumeCountAutoUpdate).toEqual({ at: expect.any(Number), from: 8, to: 10 })
  })

  it('does NOT bump a manual total just because a fresher estimate exists for a volume that has not released yet (preorder)', () => {
    const s = series({
      manualTotalVolumeCount: 10,
      estimatedTotalVolumeCount: 11,
      estimatedLatestReleaseDateISO: isoDaysFromNow(5),
    })
    const result = withCorrectedManualTotal(s, 10)
    expect(result).toBe(s)
    expect(result.manualTotalVolumeCount).toBe(10)
  })

  it('bumps a manual total by the newly-detected volume once its release is actually confirmed (past release date)', () => {
    const s = series({
      manualTotalVolumeCount: 10,
      estimatedTotalVolumeCount: 11,
      estimatedLatestReleaseDateISO: isoDaysFromNow(-1),
    })
    const result = withCorrectedManualTotal(s, 10)
    expect(result.manualTotalVolumeCount).toBe(11)
    expect(result.manualTotalVolumeCountAutoUpdate).toEqual({ at: expect.any(Number), from: 10, to: 11 })
  })

  it('does not re-bump a manual total that already covers a confirmed release (e.g. user set a deliberate buffer)', () => {
    const s = series({
      manualTotalVolumeCount: 15,
      estimatedTotalVolumeCount: 11,
      estimatedLatestReleaseDateISO: isoDaysFromNow(-1),
    })
    expect(withCorrectedManualTotal(s, 10)).toBe(s)
  })
})
